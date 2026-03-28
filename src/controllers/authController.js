import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";
import dotenv from "dotenv";
import { sendOtpToEmail } from "../services/emailService.js";
import crypto from "crypto";

dotenv.config();

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // 1️⃣ Validate input
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Email/Phone and password are required" });
    }

    const normalizedIdentifier = String(identifier).trim();

    // 2️⃣ Check if identifier is email or phone
    const isEmail = normalizedIdentifier.includes("@");

    // 3️⃣ Fetch user from Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq(isEmail ? "email" : "mobile", normalizedIdentifier)
      .limit(1);

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

    // ✅ Log only after user is confirmed
    console.log(
      `${user.user_name} logged in ${new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")}`,
    );

    // 5️⃣ Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user.id, is_admin: user.is_admin },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "3h" },
    );

    const refreshToken = jwt.sign(
      { id: user.id, is_admin: user.is_admin },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" },
    );

    // 6️⃣ Send response
    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        is_admin: user.is_admin,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

const signupInitiate = async (req, res) => {
  try {
    const { user_name, email, mobile, password } = req.body;

    if (!user_name || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedMobile = String(mobile).replace(/\D/g, "");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (normalizedMobile.length !== 10) {
      return res.status(400).json({ message: "Invalid mobile number" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password too short" });
    }

    const { data: existingEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const { data: existingMobile } = await supabase
      .from("users")
      .select("id")
      .eq("mobile", normalizedMobile)
      .maybeSingle();

    if (existingMobile) {
      return res.status(409).json({ message: "Mobile already registered" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from("email_verifications").insert([
      {
        email: normalizedEmail,
        otp_hash: otpHash,
        user_name,
        mobile: normalizedMobile,
        password_hash: await bcrypt.hash(password, 10),
        expires_at: expiresAt.toISOString(),
        verified: false,
      },
    ]);

    await sendOtpToEmail(normalizedEmail, otp);

    res.status(201).json({
      message: "Verification code sent to email",
      expires_in: 300,
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Email or mobile already registered" });
    }

    res.status(500).json({ message: "Internal server error" });
  }
};

const signupVerify = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const { data: record, error } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !record) {
      return res.status(404).json({ message: "OTP record not found" });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== record.otp_hash) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const { error: insertError } = await supabase.from("users").insert([
      {
        user_name: record.user_name,
        email: String(record.email).trim().toLowerCase(),
        mobile: String(record.mobile).replace(/\D/g, ""),
        password: record.password_hash,
      },
    ]);

    if (insertError) {
      if (insertError.code === "23505") {
        return res.status(409).json({ message: "Email or mobile already registered" });
      }
      throw insertError;
    }

    await supabase
      .from("email_verifications")
      .update({ verified: true })
      .eq("email", normalizedEmail);

    res.status(201).json({ message: "Signup successful" });
  } catch (error) {
    console.error("Signup verify error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify refresh token
    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res
          .status(403)
          .json({ message: "Invalid or expired refresh token" });
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { id: decoded.id, is_admin: decoded.is_admin },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "3h" },
      );

      res.status(200).json({
        message: "Access token refreshed successfully",
        accessToken,
      });
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export { login, signupInitiate, signupVerify, refreshToken };
