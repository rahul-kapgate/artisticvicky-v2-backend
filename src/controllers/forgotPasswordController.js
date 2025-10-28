import { supabase } from "../config/supabaseClient.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendOtpToEmail } from "../services/emailService.js";


const forgotPasswordInitiate = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 1️⃣ Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 3️⃣ Store OTP in forgot_passwords table
    await supabase.from("forgot_passwords").insert([
      {
        email,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        verified: false,
      },
    ]);

    // 4️⃣ Send OTP to user's email
    await sendOtpToEmail(email, otp);

    res.status(200).json({
      message: "OTP sent to your email for password reset",
      expires_in: 300, // 5 minutes
    });

  } catch (error) {
    console.error("Forgot password initiate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const forgotPasswordVerify = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // 1️⃣ Fetch the latest OTP record
    const { data: record, error } = await supabase
      .from("forgot_passwords")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      return res.status(404).json({ message: "OTP record not found" });
    }

    // 2️⃣ Check expiry
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // 3️⃣ Compare OTP hash
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== record.otp_hash) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 4️⃣ Update password in users table
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("email", email);

    if (updateError) throw updateError;

    // 5️⃣ Mark OTP as verified
    await supabase
      .from("forgot_passwords")
      .update({ verified: true })
      .eq("email", email);

    res.status(200).json({ message: "Password reset successful" });

  } catch (error) {
    console.error("Forgot password verify error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export { forgotPasswordInitiate, forgotPasswordVerify };
