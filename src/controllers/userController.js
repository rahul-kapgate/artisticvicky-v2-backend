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
      .select("id, user_name, email, mobile, is_admin, created_at, avatar_id")
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

/**
 * PATCH /api/users/profile
 * Update avatar_id for logged-in user
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar_id } = req.body;

    if (avatar_id === undefined || avatar_id === null) {
      return res
        .status(400)
        .json({ success: false, message: "avatar_id is required" });
    }

    if (!Number.isInteger(avatar_id) || avatar_id < 0 || avatar_id > 9) {
      return res
        .status(400)
        .json({ success: false, message: "avatar_id must be between 0 and 9" });
    }

    const { error } = await supabase
      .from("users")
      .update({ avatar_id })
      .eq("id", userId);

    if (error) {
      console.error("Update avatar error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update avatar" });
    }

    res.status(200).json({ success: true, message: "Avatar updated" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
