import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient.js";
import dotenv from "dotenv";
import { sendOtpToEmail } from "../services/emailService.js";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

const generateAuthTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      is_admin: user.is_admin,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "3h",
    },
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      is_admin: user.is_admin,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    },
  );

  return {
    accessToken,
    refreshToken,
  };
};

dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account uses Google Sign-In. Please continue with Google.",
        code: "GOOGLE_ACCOUNT",
      });
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
        avatar_id: user.avatar_id,
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
        return res
          .status(409)
          .json({ message: "Email or mobile already registered" });
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

const googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;

    // 1. Validate request
    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required",
      });
    }

    // 2. Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        message: "Invalid Google credential",
      });
    }

    const {
      sub: googleId,
      email,
      email_verified: emailVerified,
      name,
      picture,
    } = payload;

    // 3. Validate required Google account information
    if (!googleId || !email) {
      return res.status(400).json({
        message: "Google account information is incomplete",
      });
    }

    if (!emailVerified) {
      return res.status(401).json({
        message: "Google email is not verified",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 4. First search by Google ID
    const { data: googleUser, error: googleUserError } = await supabase
      .from("users")
      .select("*")
      .eq("google_id", googleId)
      .maybeSingle();

    if (googleUserError) {
      throw googleUserError;
    }

    let user = googleUser;

    // 5. If Google ID is not linked, search by email
    if (!user) {
      const { data: existingEmailUser, error: emailUserError } = await supabase
        .from("users")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (emailUserError) {
        throw emailUserError;
      }

      // 6. Link Google with existing local account
      if (existingEmailUser) {
        const updatedProvider = existingEmailUser.password
          ? "local_google"
          : "google";

        const { data: linkedUser, error: linkError } = await supabase
          .from("users")
          .update({
            google_id: googleId,
            auth_provider: updatedProvider,
            email_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEmailUser.id)
          .select("*")
          .single();

        if (linkError) {
          throw linkError;
        }

        user = linkedUser;
      } else {
        // 7. Create a new Google-only user
        const { data: newUser, error: createUserError } = await supabase
          .from("users")
          .insert([
            {
              user_name: name || normalizedEmail.split("@")[0],
              email: normalizedEmail,
              mobile: null,
              password: null,
              is_admin: false,
              avatar_id: 1,
              auth_provider: "google",
              google_id: googleId,
              email_verified: true,
              updated_at: new Date().toISOString(),
            },
          ])
          .select("*")
          .single();

        if (createUserError) {
          throw createUserError;
        }

        user = newUser;
      }
    }

    // 8. Generate your application JWT tokens
    const { accessToken, refreshToken } = generateAuthTokens(user);

    console.log(
      `${user.user_name || user.email} logged in with Google at ${new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")}`,
    );

    // 9. Return the same response format as normal login
    return res.status(200).json({
      message: "Google login successful",
      user: {
        id: user.id,
        user_name: user.user_name,
        email: user.email,
        mobile: user.mobile,
        is_admin: user.is_admin,
        avatar_id: user.avatar_id,
        auth_provider: user.auth_provider,
        profile_picture: picture || null,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Google login error:", error);

    if (
      error.message?.includes("Wrong recipient") ||
      error.message?.includes("Invalid token") ||
      error.message?.includes("Token used too late")
    ) {
      return res.status(401).json({
        message: "Invalid or expired Google credential",
      });
    }

    next(error);
  }
};

export { login, signupInitiate, signupVerify, refreshToken, googleLogin };
