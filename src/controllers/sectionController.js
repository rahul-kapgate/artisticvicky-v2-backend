import { supabase } from "../config/supabaseClient.js";

/**
 * ➕ Create Section
 */
export const createSection = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Section title must be at least 3 characters long.",
      });
    }

    const { data, error } = await supabase
      .from("sections")
      .insert([{ title: title.trim(), description: description?.trim() || null }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: `Section '${data.title}' created successfully.`,
      data,
    });
  } catch (err) {
    console.error("Error creating section:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating section.",
    });
  }
};

/**
 * 📋 Get All Sections (with associated videos)
 */
export const getSectionsWithVideos = async (req, res) => {
  try {
    const { data: sections, error } = await supabase
      .from("sections")
      .select(`
        id,
        title,
        description,
        created_at,
        video_lectures (
          id,
          title,
          youtube_url,
          thumbnail_url,
          duration,
          is_free,
          created_at
        )
      `)
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (!sections || sections.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No sections found. Try adding one.",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: `Fetched ${sections.length} section(s) successfully.`,
      data: sections,
    });
  } catch (err) {
    console.error("Error fetching sections:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while fetching sections.",
    });
  }
};

/**
 * ✏️ Update Section (Edit)
 */
export const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: "A valid section ID is required for update.",
      });
    }

    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Section title must be at least 3 characters long.",
      });
    }

    // Check if section exists
    const { data: existing, error: fetchError } = await supabase
      .from("sections")
      .select("id, title")
      .eq("id", id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Section with ID ${id} not found.`,
      });
    }

    // Update
    const { data, error } = await supabase
      .from("sections")
      .update({
        title: title.trim(),
        description: description?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Section '${data.title}' updated successfully.`,
      data,
    });
  } catch (err) {
    console.error("Error updating section:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating section.",
    });
  }
};

/**
 * 🗑️ Delete Section (Cascade delete videos)
 */
export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: "A valid section ID is required for deletion.",
      });
    }

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from("sections")
      .select("id, title")
      .eq("id", id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Section with ID ${id} not found.`,
      });
    }

    // Delete
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Section '${existing.title}' and its videos deleted successfully.`,
    });
  } catch (err) {
    console.error("Error deleting section:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while deleting section.",
    });
  }
};
