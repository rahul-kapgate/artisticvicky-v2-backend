import { supabase } from "../config/supabaseClient.js";
import multer from "multer";
import fs from "fs";

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
      return res.status(400).json({ success: false, message: "Title and type are required" });
    }
    if (!file) {
      return res.status(400).json({ success: false, message: "File is required" });
    }

    // ✅ Upload file to Supabase Storage
    const filePath = `resources/${Date.now()}_${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("resources")
      .upload(filePath, fs.createReadStream(file.path), {
        cacheControl: "3600",
        upsert: false,
        contentType: file.mimetype,
        duplex: "half",
      });

    fs.unlinkSync(file.path);
    if (uploadError) throw uploadError;

    // ✅ Get public URL
    const { data: publicUrlData } = supabase.storage.from("resources").getPublicUrl(filePath);
    const fileUrl = publicUrlData.publicUrl;

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
    console.error("❌ Error creating resource:", err.message);
    res.status(500).json({ success: false, message: "Server error while uploading resource" });
  }
};

/** ----------------------------------------------------------------
 * 🟠 Get All / Filtered Resources
 * ---------------------------------------------------------------- */
export const getAllResources = async (req, res) => {
  try {
    const { type } = req.query;
    let query = supabase.from("resources").select("*").order("created_at", { ascending: false });

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
    console.error("❌ Get resources error:", error.message);
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
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    let fileUrl = existing.file_url;

    // 🧹 Upload new file if provided
    if (file) {
      const oldPath = existing.file_url.split("resources/")[1];
      if (oldPath) await supabase.storage.from("resources").remove([oldPath]);

      const filePath = `resources/${Date.now()}_${file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from("resources")
        .upload(filePath, fs.createReadStream(file.path), {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimetype,
          duplex: "half",
        });

      fs.unlinkSync(file.path);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("resources").getPublicUrl(filePath);
      fileUrl = publicUrlData.publicUrl;
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
    console.error("❌ Update resource error:", err.message);
    res.status(500).json({ success: false, message: "Server error while updating resource" });
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
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    // 🧹 Delete from storage
    const filePath = resource.file_url.split("resources/")[1];
    if (filePath) await supabase.storage.from("resources").remove([filePath]);

    // 🗑️ Delete DB row
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) throw error;

    res.status(200).json({ success: true, message: "Resource deleted successfully" });
  } catch (err) {
    console.error("❌ Delete resource error:", err.message);
    res.status(500).json({ success: false, message: "Server error while deleting resource" });
  }
};

export { upload };
