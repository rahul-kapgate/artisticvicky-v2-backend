import { supabase } from "../config/supabaseClient.js";

export const createCourse = async (req, res) => {
  try {
    const { course_name, description, price, image, category, level, language, duration, is_published, tags } = req.body;

    // Validate required fields
    if (!course_name || !description || !price || !image) {
      return res.status(400).json({ success: false, message: "All required fields must be provided" });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from("courses")
      .insert([
        {
          course_name,
          description,
          price,
          image,
          category,
          level,
          language,
          duration,
          is_published,
          created_by: req.user.id,
          tags,
        },
      ])
      .select();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: data[0],
    });
  } catch (err) {
    console.error("Error creating course:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error while creating course",
    });
  }
};
