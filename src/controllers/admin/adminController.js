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
      .select("id, course_name, students_enrolled, price, category, rating, blocked_users");

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


// Block a user from a course
export const blockUserFromCourse = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    // Fetch current blocked_users array
    const { data: course, error: fetchErr } = await supabase
      .from("courses")
      .select("blocked_users")
      .eq("id", courseId)
      .single();

    if (fetchErr) throw fetchErr;

    const current = course.blocked_users || [];
    if (current.includes(Number(userId))) {
      return res.status(400).json({
        success: false,
        message: "User is already blocked for this course",
      });
    }

    const updated = [...current, Number(userId)];

    const { error: updateErr } = await supabase
      .from("courses")
      .update({ blocked_users: updated })
      .eq("id", courseId);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      message: "User blocked from this course",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Unblock a user
export const unblockUserFromCourse = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    const { data: course, error: fetchErr } = await supabase
      .from("courses")
      .select("blocked_users")
      .eq("id", courseId)
      .single();

    if (fetchErr) throw fetchErr;

    const updated = (course.blocked_users || []).filter(
      (id) => id !== Number(userId)
    );

    const { error: updateErr } = await supabase
      .from("courses")
      .update({ blocked_users: updated })
      .eq("id", courseId);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      message: "User unblocked for this course",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// List blocked users for a course (with details)
export const getBlockedUsers = async (req, res) => {
  try {
    const { courseId } = req.params;

    const { data: course, error } = await supabase
      .from("courses")
      .select("blocked_users")
      .eq("id", courseId)
      .single();

    if (error) throw error;

    const ids = course.blocked_users || [];
    if (ids.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, user_name, email, mobile")
      .in("id", ids);

    if (usersErr) throw usersErr;

    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



