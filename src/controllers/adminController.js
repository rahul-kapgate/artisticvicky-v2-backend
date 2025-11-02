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

// ✅ Get all users and their enrolled courses
export const getUsersWithCourses = async (req, res) => {
  try {
    // Fetch all users
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, user_name, email, mobile, is_admin, created_at");

    if (userError) throw userError;

    // Fetch all courses
    const { data: courses, error: courseError } = await supabase
      .from("courses")
      .select("id, course_name, students_enrolled, price, category, rating");

    if (courseError) throw courseError;

    // Build mapping: user → enrolled courses
    const userCourses = users.map((user) => {
      const enrolledCourses = courses.filter(
        (course) => Array.isArray(course.students_enrolled) && course.students_enrolled.includes(user.id)
      );
      return { ...user, enrolledCourses };
    });

    res.status(200).json({
      success: true,
      message: "Fetched users with their enrolled courses",
      count: userCourses.length,
      data: userCourses,
    });
  } catch (error) {
    console.error("Get users with courses error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ✅ Enroll user in a specific course
export const enrollUserInCourse = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "userId and courseId are required",
      });
    }

    // Get existing students_enrolled
    const { data: course, error: fetchError } = await supabase
      .from("courses")
      .select("students_enrolled")
      .eq("id", courseId)
      .single();

    if (fetchError) throw fetchError;

    const updatedArray = Array.isArray(course.students_enrolled)
      ? [...new Set([...course.students_enrolled, userId])]
      : [userId];

    // Update course
    const { error: updateError } = await supabase
      .from("courses")
      .update({ students_enrolled: updatedArray })
      .eq("id", courseId);

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: `User ${userId} successfully enrolled in course ${courseId}`,
    });
  } catch (error) {
    console.error("Enroll user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

