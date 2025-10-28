import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";
import dotenv from "dotenv";
import { sendOtpToEmail } from "../services/emailService.js"
import crypto from "crypto";

dotenv.config();

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // 1️⃣ Validate input
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Phone and password are required" });
    }

    // 2️⃣ Check if identifier is email or phone
    const isEmail = identifier.includes("@");

    // 3️⃣ Fetch user from Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq(isEmail ? "email" : "mobile", identifier)
      .limit(1);

    console.log(users)

    if (error) throw error;
    const user = users?.[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 4️⃣ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 5️⃣ Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "3h" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "2d" }
    );

    // 6️⃣ Send response
    res.status(200).json({
      message: "Login successful",
      user: { id: user._id, email: user.email, mobile: user.mobile },
      accessToken,
      refreshToken,
    });

  } catch (error) {
    next(error);
  }
}

const signupInitiate = async (req, res) => {

  try {
    const { user_name, email, mobile, password } = req.body;

    // 1️⃣ Validate input
    if (!user_name || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password too short" });
    }

    // 2️⃣ Check if email already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 3️⃣ Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 4️⃣ Store OTP in email_verifications table
    await supabase.from("email_verifications").insert([
      {
        email,
        otp_hash: otpHash,
        user_name,
        mobile,
        password_hash: await bcrypt.hash(password, 10),
        expires_at: expiresAt.toISOString(),
        verified: false,
      },
    ]);

    // 5️⃣ Send email with OTP
    await sendOtpToEmail(email, otp);

    res.status(201).json({
      message: "Verification code sent to email",
      expires_in: 300,
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });

  }

}

const signupVerify = async (req, res) => {

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // 1️⃣ Fetch OTP record
    const { data: record, error } = await supabase
      .from("email_verifications")
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

    // 4️⃣ Insert user into main users table
    const { error: insertError } = await supabase.from("users").insert([
      {
        user_name: record.user_name,
        email: record.email,
        mobile: record.mobile,
        password: record.password_hash,
      },
    ]);

    if (insertError) throw insertError;

     // 5️⃣ Mark OTP record as verified
     await supabase
     .from("email_verifications")
     .update({ verified: true })
     .eq("email", email);

    res.status(201).json({ message: "Signup successful" });

  } catch (error) {
    console.error("Signup verify error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export { login, signupInitiate, signupVerify  };