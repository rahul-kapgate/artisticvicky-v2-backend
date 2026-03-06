import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import { s3 } from "../config/s3Client.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const uploadArt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      file.mimetype,
    );
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

const safeName = (name = "image") => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildS3Url = (key) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

async function uploadArtworkImage(file) {
  const key = `student-artworks/${Date.now()}_${safeName(file.originalname)}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return {
    key,
    url: buildS3Url(key),
  };
}

function getS3KeyFromUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const expectedHost = `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;

    if (parsed.host !== expectedHost) return null;

    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

async function deleteArtworkImageFromS3(imageUrl) {
  const key = getS3KeyFromUrl(imageUrl);
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  await s3.send(command);
}

// 📌 ADD ARTWORK (ADMIN ONLY)
export const createStudentArtWork = async (req, res) => {
  try {
    const { student_name, title, city } = req.body;
    const file = req.file;

    if (!student_name || !title) {
      return res.status(400).json({
        success: false,
        message: "Student name and title are required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Artwork image is required",
      });
    }

    // ✅ Upload to S3
    const { url: imageUrl } = await uploadArtworkImage(file);

    // ✅ Insert into Supabase table
    const { data, error } = await supabase
      .from("student_art_work")
      .insert([
        {
          student_name,
          title,
          city,
          image: imageUrl,
          created_by: req.user.id,
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Student artwork added successfully",
      data: data[0],
    });
  } catch (err) {
    console.error("Create artwork error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error while adding artwork",
      error: err.message,
    });
  }
};

// 📌 GET ALL ARTWORK (PUBLIC)
export const getAllStudentArtWork = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("student_art_work")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (e) {
    console.error("Get artworks error:", e);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 📌 GET SINGLE ARTWORK
export const getStudentArtWorkById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("student_art_work")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res
        .status(404)
        .json({ success: false, message: "Artwork not found" });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (e) {
    console.error("Get artwork by ID error:", e);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 📌 UPDATE ARTWORK (ADMIN)
export const updateStudentArtWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { student_name, title, city } = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from("student_art_work")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res
        .status(404)
        .json({ success: false, message: "Artwork not found" });
    }

    let imageUrl = existing.image;

    // ✅ If new image uploaded
    if (req.file) {
      const uploaded = await uploadArtworkImage(req.file);
      imageUrl = uploaded.url;

      // optional old image delete
      if (existing.image) {
        try {
          await deleteArtworkImageFromS3(existing.image);
        } catch (deleteErr) {
          console.error("Old artwork image delete failed:", deleteErr.message);
        }
      }
    }

    const { data, error } = await supabase
      .from("student_art_work")
      .update({
        student_name,
        title,
        city,
        image: imageUrl,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Artwork updated successfully",
      data: data[0],
    });
  } catch (e) {
    console.error("Update artwork error:", e.message);
    res.status(500).json({
      success: false,
      message: "Server error while updating artwork",
      error: e.message,
    });
  }
};

// 📌 DELETE ARTWORK (ADMIN)
export const deleteStudentArtWork = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: artwork, error: fetchError } = await supabase
      .from("student_art_work")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !artwork) {
      return res
        .status(404)
        .json({ success: false, message: "Artwork not found" });
    }

    // ✅ Remove image from S3
    if (artwork.image) {
      try {
        await deleteArtworkImageFromS3(artwork.image);
      } catch (deleteErr) {
        console.error("Artwork image delete failed:", deleteErr.message);
      }
    }

    const { error } = await supabase
      .from("student_art_work")
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Artwork deleted successfully",
    });
  } catch (e) {
    console.error("Delete artwork error:", e.message);
    res.status(500).json({
      success: false,
      message: "Server error while deleting artwork",
      error: e.message,
    });
  }
};
