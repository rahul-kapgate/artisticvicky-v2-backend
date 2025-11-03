import { supabase } from "../config/supabaseClient.js";
import fs from "fs";

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

// ✅ Dashboard summary API
export const getDashboardStats = async (req, res) => {
  try {
    // Count total courses
    const { count: courseCount, error: courseError } = await supabase
      .from("courses")
      .select("id", { count: "exact", head: true });

    if (courseError) throw courseError;

    // Count total users
    const { count: userCount, error: userError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (userError) throw userError;

    // Calculate total enrollments across all courses
    const { data: courses, error: enrollError } = await supabase
      .from("courses")
      .select("students_enrolled");

    if (enrollError) throw enrollError;

    let totalEnrollments = 0;
    if (courses?.length) {
      totalEnrollments = courses.reduce((acc, c) => {
        if (Array.isArray(c.students_enrolled)) {
          return acc + c.students_enrolled.length;
        }
        return acc;
      }, 0);
    }

    return res.status(200).json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data: {
        totalCourses: courseCount || 0,
        totalUsers: userCount || 0,
        totalEnrollments,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching dashboard stats",
    });
  }
};


