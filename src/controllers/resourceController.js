import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import fs from "fs";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { b2Client, B2_BUCKET, B2_PUBLIC_BASE_URL } from "../config/b2Client.js";

const upload = multer({ dest: "uploads/" });

/** ----------------------------------------------------------------
 * 🟢 Create Resource (Admin Only)
 * ---------------------------------------------------------------- */
export const createResource = async (req, res) => {
  try {
    const { title, description, type } = req.body;
    const file = req.file;

    // ✅ Validate input
    if (!title || !type) {
      return res
        .status(400)
        .json({ success: false, message: "Title and type are required" });
    }
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "File is required" });
    }

    const key = `resources/${Date.now()}_${file.originalname}`;

    try {
      await b2Client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,
          Body: fs.createReadStream(file.path),
          ContentType: file.mimetype,
        })
      );
    } finally {
      // ensure temp file is removed even if upload fails
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    const fileUrl = `${B2_PUBLIC_BASE_URL}/${key}`;

    // ✅ Insert metadata into DB
    const { data, error } = await supabase
      .from("resources")
      .insert([
        {
          title,
          description,
          type,
          file_url: fileUrl,
          file_name: file.originalname,
          mime_type: file.mimetype,
          uploaded_by: req.user?.id || null,
        },
      ])
      .select();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Resource uploaded successfully",
      data: data[0],
    });
  } catch (err) {
    console.error("❌ Error creating resource:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error while uploading resource" });
  }
};

/** ----------------------------------------------------------------
 * 🟠 Get All / Filtered Resources
 * ---------------------------------------------------------------- */
export const getAllResources = async (req, res) => {
  try {
    const { type } = req.query;
    let query = supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false });

    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Resources fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("❌ Get resources error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** ----------------------------------------------------------------
 * 🟡 Update Resource Metadata
 * ---------------------------------------------------------------- */
export const updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type } = req.body;
    const file = req.file;

    const { data: existing, error: fetchError } = await supabase
      .from("resources")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found" });
    }

    let fileUrl = existing.file_url;

    // 🧹 Upload new file if provided
    if (file) {
      // 🧹 Delete old file from Backblaze if it exists
      if (existing.file_url) {
        const oldKey = existing.file_url.replace(`${B2_PUBLIC_BASE_URL}/`, "");
        if (oldKey) {
          await b2Client.send(
            new DeleteObjectCommand({
              Bucket: B2_BUCKET,
              Key: oldKey,
            })
          );
        }
      }

      const key = `resources/${Date.now()}_${file.originalname}`;

      try {
        await b2Client.send(
          new PutObjectCommand({
            Bucket: B2_BUCKET,
            Key: key,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype,
          })
        );
      } finally {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }

      fileUrl = `${B2_PUBLIC_BASE_URL}/${key}`;
    }

    const { data, error } = await supabase
      .from("resources")
      .update({
        title,
        description,
        type,
        file_url: fileUrl,
        file_name: file?.originalname || existing.file_name,
        mime_type: file?.mimetype || existing.mime_type,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Resource updated successfully",
      data: data[0],
    });
  } catch (err) {
    console.error("❌ Update resource error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error while updating resource" });
  }
};

/** ----------------------------------------------------------------
 * 🔴 Delete Resource (Admin Only)
 * ---------------------------------------------------------------- */
export const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: resource, error: fetchError } = await supabase
      .from("resources")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found" });
    }

    // 🧹 Delete from Backblaze B2 storage
    if (resource.file_url) {
      const key = resource.file_url.replace(`${B2_PUBLIC_BASE_URL}/`, "");
      if (key) {
        await b2Client.send(
          new DeleteObjectCommand({
            Bucket: B2_BUCKET,
            Key: key,
          })
        );
      }
    }

    // 🗑️ Delete DB row
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) throw error;

    res
      .status(200)
      .json({ success: true, message: "Resource deleted successfully" });
  } catch (err) {
    console.error("❌ Delete resource error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error while deleting resource" });
  }
};

/** ----------------------------------------------------------------
 * 📄 Stream Resource File (Private B2 bucket → frontend)
 * ---------------------------------------------------------------- */
export const streamResourceFile = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Find resource in DB
    const { data: resource, error } = await supabase
      .from("resources")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !resource) {
      return res
        .status(404)
        .json({ success: false, message: "Resource not found" });
    }

    if (!resource.file_url) {
      return res
        .status(400)
        .json({ success: false, message: "No file linked to this resource" });
    }

    // 2️⃣ Derive B2 object key from stored URL
    const key = resource.file_url.replace(`${B2_PUBLIC_BASE_URL}/`, "");

    if (!key) {
      return res
        .status(500)
        .json({ success: false, message: "Invalid file URL configuration" });
    }

    // 3️⃣ Fetch object from B2
    const command = new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    });

    const b2Response = await b2Client.send(command);

    // 4️⃣ Set headers and stream body
    const contentType = b2Response.ContentType || "application/octet-stream";
    const filename =
      resource.file_name || key.split("/")[key.split("/").length - 1];

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(filename)}"`
    );

    // `Body` is a stream in Node; pipe it to response
    b2Response.Body.pipe(res);
  } catch (err) {
    console.error("❌ Stream resource file error:", err);

    // If B2 says "not found", return 404
    if (err?.$metadata?.httpStatusCode === 404) {
      return res
        .status(404)
        .json({ success: false, message: "File not found in storage" });
    }

    res
      .status(500)
      .json({ success: false, message: "Error streaming resource file" });
  }
};

export { upload };
