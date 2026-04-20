import { supabase } from "../../config/supabaseClient.js";
import { issueInvoiceAndEnroll } from "../../services/invoiceService.js";

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


export const enrollUserInCourse = async (req, res) => {
  try {
    const { userId, courseId, amount, notes } = req.body;

    if (!userId || !courseId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "userId, courseId and amount are required",
      });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a non-negative number",
      });
    }

    const result = await issueInvoiceAndEnroll({
      userId,
      courseId,
      amount: numericAmount,
      source: "manual",
      notes: typeof notes === "string" ? notes.trim().slice(0, 500) : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "User enrolled and invoice sent",
      data: result,
    });
  } catch (error) {
    console.error("enrollUserInCourse error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
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

export const getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, user_name, email, mobile, is_admin, created_at")
      .order("id", { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      users: data,
    });
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};




