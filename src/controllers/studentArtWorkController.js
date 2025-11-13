import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import fs from "fs";

export const uploadArt = multer({ dest: "uploads/" });

// 📌 ADD ARTWORK (ADMIN ONLY)
export const createStudentArtWork = async (req, res) => {
  try {
    const { student_name, title, city  } = req.body;
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

    // Upload to Supabase
    const filePath = `art/${Date.now()}_${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("student_art_work")
      .upload(filePath, fs.createReadStream(file.path), {
        upsert: false,
        contentType: file.mimetype,
        duplex: "half",
      });

    fs.unlinkSync(file.path);
    if (uploadError) throw uploadError;

    // Public URL
    const { data: urlData } = supabase.storage
      .from("student_art_work")
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Insert into table
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
      return res.status(404).json({ success: false, message: "Artwork not found" });
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
    const { student_name, title, city  } = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from("student_art_work")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing)
      return res.status(404).json({ success: false, message: "Artwork not found" });

    let imageUrl = existing.image;

    // If new image uploaded
    if (req.file) {
      // Delete old image
      if (existing.image) {
        const oldPath = existing.image.split("student_art_work/")[1];
        if (oldPath) {
          await supabase.storage.from("student_art_work").remove([oldPath]);
        }
      }

      const filePath = `art/${Date.now()}_${req.file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("student_art_work")
        .upload(filePath, fs.createReadStream(req.file.path), {
          upsert: false,
          contentType: req.file.mimetype,
          duplex: "half",
        });

      fs.unlinkSync(req.file.path);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("student_art_work")
        .getPublicUrl(filePath);
      imageUrl = urlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("student_art_work")
      .update({
        student_name,
        title,
        city ,
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
    res.status(500).json({ success: false, message: "Server error while updating artwork" });
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

    if (fetchError || !artwork)
      return res.status(404).json({ success: false, message: "Artwork not found" });

    // Remove image
    if (artwork.image) {
      const imgPath = artwork.image.split("student_art_work/")[1];
      if (imgPath) {
        await supabase.storage.from("student_art_work").remove([imgPath]);
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
    res.status(500).json({ success: false, message: "Server error while deleting artwork" });
  }
};
