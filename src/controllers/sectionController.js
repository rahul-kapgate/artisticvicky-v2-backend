import { supabase } from "../config/supabaseClient.js";

/**
 * ➕ Create Section
 */
export const createSection = async (req, res) => {
  try {
    const { title, description, course_id } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Section title must be at least 3 characters long.",
      });
    }

    // ✅ Validate course_id
    const parsedCourseId = course_id ? parseInt(course_id, 10) : 1;
    if (isNaN(parsedCourseId) || parsedCourseId < 1) {
      return res.status(400).json({
        success: false,
        message: "A valid course_id is required.",
      });
    }

    const { data, error } = await supabase
      .from("sections")
      .insert([
        {
          title: title.trim(),
          description: description?.trim() || null,
          course_id: parsedCourseId, 
        },
      ])
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
 * 📋 Get All Sections with Videos — filtered by course_id
 */
export const getSectionsWithVideos = async (req, res) => {
  try {
    const { course_id } = req.query; // ✅ added course_id filter

    // ✅ course_id is required — sections are always scoped to a course
    if (!course_id || isNaN(Number(course_id))) {
      return res.status(400).json({
        success: false,
        message: "A valid course_id query param is required.",
      });
    }

    const { data: sections, error } = await supabase
      .from("sections")
      .select(
        `
        id,
        title,
        description,
        course_id,
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
      `,
      )
      .eq("course_id", Number(course_id)) // ✅ filter by course
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (!sections || sections.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No sections found for this course. Try adding one.",
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
 * ✏️ Update Section
 */
export const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, course_id } = req.body; // ✅ added course_id

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
      .select("id, title, course_id")
      .eq("id", id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Section with ID ${id} not found.`,
      });
    }

    // ✅ Resolve course_id — keep existing if not provided
    let resolvedCourseId = existing.course_id;
    if (course_id !== undefined) {
      const parsed = parseInt(course_id, 10);
      if (isNaN(parsed) || parsed < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid course_id provided.",
        });
      }
      resolvedCourseId = parsed;
    }

    const { data, error } = await supabase
      .from("sections")
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        course_id: resolvedCourseId, // ✅ added
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
 * 🗑️ Delete Section (Cascade deletes videos via DB constraint)
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
