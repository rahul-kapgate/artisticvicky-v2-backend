import { supabase } from "../config/supabaseClient.js";

/**
 * GET /api/users/profile
 * Retrieve logged-in user profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("id, user_name, email, mobile, is_admin, created_at")
      .eq("id", userId)
      .single();

    if (error || !data)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      success: true,
      user: data,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
