import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { supabase } from "../config/supabaseClient.js";
import { sendOtpToEmail } from "../services/emailService.js";

dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* =========================================================
   TOKEN HELPERS
========================================================= */

const generateAuthTokens = (user) => {
  const tokenVersion = user.token_version ?? 0;

  const accessToken = jwt.sign(
    {
      id: user.id,
      is_admin: user.is_admin,
      tokenVersion,
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
      tokenVersion,
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

/**
 * This token is ONLY for account reactivation.
 *
 * It must NOT use ACCESS_TOKEN_SECRET because otherwise
 * an auth middleware that only validates the JWT signature
 * could accidentally accept it as a normal access token.
 */
const generateReactivationToken = (user) => {
  if (!process.env.REACTIVATION_TOKEN_SECRET) {
    throw new Error("REACTIVATION_TOKEN_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user.id,
      purpose: "account_reactivation",
      tokenVersion: user.token_version ?? 0,
    },
    process.env.REACTIVATION_TOKEN_SECRET,
    {
      expiresIn: "10m",
    },
  );
};

/* =========================================================
   PENDING DELETION LOGIN RESPONSE
========================================================= */

const handlePendingDeletionLogin = (user, res) => {
  if (user.account_status !== "pending_deletion") {
    return false;
  }

  const deletionScheduledAt = user.deletion_scheduled_at || null;

  /*
   * If 30 days have already passed, do not allow
   * reactivation even if the cleanup cron has not yet
   * permanently deleted the database row.
   */
  if (
    deletionScheduledAt &&
    new Date(deletionScheduledAt).getTime() <= Date.now()
  ) {
    res.status(410).json({
      success: false,
      code: "ACCOUNT_DELETION_PERIOD_EXPIRED",
      message: "The account recovery period has expired.",
      deletionScheduledAt,
      canReactivate: false,
    });

    return true;
  }

  const reactivationToken = generateReactivationToken(user);

  res.status(200).json({
    success: true,
    code: "ACCOUNT_PENDING_DELETION",
    message:
      "Your account is scheduled for deletion. You can reactivate it before the deletion date.",
    deletionScheduledAt,
    canReactivate: true,
    reactivationToken,
  });

  return true;
};

/* =========================================================
   LOGIN
========================================================= */

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    // 1. Validate
    if (!identifier || !password) {
      return res.status(400).json({
        message: "Email/Phone and password are required",
      });
    }

    const rawIdentifier = String(identifier).trim();

    const isEmail = rawIdentifier.includes("@");

    const normalizedIdentifier = isEmail
      ? rawIdentifier.toLowerCase()
      : rawIdentifier.replace(/\D/g, "");

    // 2. Find user
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq(isEmail ? "email" : "mobile", normalizedIdentifier)
      .limit(1);

    if (error) {
      throw error;
    }

    const user = users?.[0];

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // 3. Google-only account
    if (!user.password) {
      return res.status(400).json({
        message:
          "This account uses Google Sign-In. Please continue with Google.",
        code: "GOOGLE_ACCOUNT",
      });
    }

    // 4. Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    /*
     * 5. Check pending deletion AFTER authentication.
     *
     * Password is correct, but don't give the user
     * normal app access yet.
     */
    if (handlePendingDeletionLogin(user, res)) {
      return;
    }

    // 6. Generate normal tokens
    const { accessToken, refreshToken } = generateAuthTokens(user);

    console.log(
      `${user.user_name || user.email} logged in ${new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")}`,
    );

    // 7. Response
    return res.status(200).json({
      message: "Login successful",

      user: {
        id: user.id,
        user_name: user.user_name,
        email: user.email,
        mobile: user.mobile,
        is_admin: user.is_admin,
        avatar_id: user.avatar_id,
        auth_provider: user.auth_provider,
      },

      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   SIGNUP INITIATE
========================================================= */

const signupInitiate = async (req, res) => {
  try {
    const { user_name, email, mobile, password } = req.body;

    if (!user_name || !email || !mobile || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const normalizedMobile = String(mobile).replace(/\D/g, "");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    if (normalizedMobile.length !== 10) {
      return res.status(400).json({
        message: "Invalid mobile number",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password too short",
      });
    }

    const { data: existingEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const { data: existingMobile } = await supabase
      .from("users")
      .select("id")
      .eq("mobile", normalizedMobile)
      .maybeSingle();

    if (existingMobile) {
      return res.status(409).json({
        message: "Mobile already registered",
      });
    }

    // Secure random 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error: verificationInsertError } = await supabase
      .from("email_verifications")
      .insert([
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

    if (verificationInsertError) {
      throw verificationInsertError;
    }

    await sendOtpToEmail(normalizedEmail, otp);

    return res.status(201).json({
      message: "Verification code sent to email",
      expires_in: 300,
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email or mobile already registered",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

/* =========================================================
   SIGNUP VERIFY
========================================================= */

const signupVerify = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: record, error } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", normalizedEmail)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .single();

    if (error || !record) {
      return res.status(404).json({
        message: "OTP record not found",
      });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    const otpHash = crypto
      .createHash("sha256")
      .update(String(otp))
      .digest("hex");

    if (otpHash !== record.otp_hash) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
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
        return res.status(409).json({
          message: "Email or mobile already registered",
        });
      }

      throw insertError;
    }

    await supabase
      .from("email_verifications")
      .update({
        verified: true,
      })
      .eq("email", normalizedEmail);

    return res.status(201).json({
      message: "Signup successful",
    });
  } catch (error) {
    console.error("Signup verify error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

/* =========================================================
   REFRESH TOKEN
========================================================= */

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({
        message: "No refresh token provided",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(403).json({
        message: "Invalid or expired refresh token",
      });
    }

    /*
     * IMPORTANT:
     * Check the actual user record.
     *
     * Without this, an old refresh token could
     * keep generating access tokens after the user
     * schedules deletion.
     */
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    /*
     * Account is currently scheduled for deletion.
     * Do not generate another access token.
     */
    if (user.account_status === "pending_deletion") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_PENDING_DELETION",
        message:
          "Your account is scheduled for deletion. Please log in again if you want to reactivate it.",
        deletionScheduledAt: user.deletion_scheduled_at,
        canReactivate: true,
      });
    }

    /*
     * Reject tokens created before token_version changed.
     */
    const tokenVersion = decoded.tokenVersion ?? 0;

    const currentTokenVersion = user.token_version ?? 0;

    if (tokenVersion !== currentTokenVersion) {
      return res.status(403).json({
        success: false,
        code: "SESSION_INVALIDATED",
        message: "Your session has expired. Please log in again.",
      });
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        is_admin: user.is_admin,
        tokenVersion: currentTokenVersion,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "3h",
      },
    );

    return res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

/* =========================================================
   GOOGLE LOGIN
========================================================= */

const googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;

    // 1. Validate
    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required",
      });
    }

    // 2. Verify Google token
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

    // 3. Required Google info
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

    // 4. Search by Google ID
    const { data: googleUser, error: googleUserError } = await supabase
      .from("users")
      .select("*")
      .eq("google_id", googleId)
      .maybeSingle();

    if (googleUserError) {
      throw googleUserError;
    }

    let user = googleUser;

    /*
     * If already linked to Google and deletion is pending,
     * return the reactivation flow immediately.
     */
    if (user && user.account_status === "pending_deletion") {
      if (handlePendingDeletionLogin(user, res)) {
        return;
      }
    }

    // 5. Search existing email
    if (!user) {
      const { data: existingEmailUser, error: emailUserError } = await supabase
        .from("users")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (emailUserError) {
        throw emailUserError;
      }

      // Existing account
      if (existingEmailUser) {
        /*
         * Google has successfully authenticated this email.
         *
         * If deletion is pending, don't modify/link the
         * account yet. Give the reactivation option first.
         */
        if (existingEmailUser.account_status === "pending_deletion") {
          if (handlePendingDeletionLogin(existingEmailUser, res)) {
            return;
          }
        }

        // Link Google with existing account
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
        // 6. New Google user
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

    /*
     * Defensive check.
     *
     * This should already have been caught above,
     * but keep it before token generation.
     */
    if (handlePendingDeletionLogin(user, res)) {
      return;
    }

    // 7. Generate normal tokens
    const { accessToken, refreshToken } = generateAuthTokens(user);

    console.log(
      `${user.user_name || user.email} logged in with Google at ${new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")}`,
    );

    // 8. Response
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

/* =========================================================
   REACTIVATE ACCOUNT
========================================================= */

const reactivateAccount = async (req, res, next) => {
  try {
    const { reactivationToken } = req.body;

    if (!reactivationToken) {
      return res.status(400).json({
        success: false,
        message: "Reactivation token is required",
      });
    }

    if (!process.env.REACTIVATION_TOKEN_SECRET) {
      throw new Error("REACTIVATION_TOKEN_SECRET is not configured");
    }

    let decoded;

    try {
      decoded = jwt.verify(
        reactivationToken,
        process.env.REACTIVATION_TOKEN_SECRET,
      );
    } catch {
      return res.status(401).json({
        success: false,
        code: "INVALID_REACTIVATION_TOKEN",
        message:
          "Invalid or expired reactivation request. Please log in again.",
      });
    }

    // Only allow special reactivation JWTs
    if (decoded.purpose !== "account_reactivation") {
      return res.status(401).json({
        success: false,
        code: "INVALID_REACTIVATION_TOKEN",
        message: "Invalid reactivation request.",
      });
    }

    const userId = decoded.id;

    // Find account
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    /*
     * If the permanent cleanup has already run,
     * there won't be a user row anymore.
     */
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message: "This account no longer exists.",
      });
    }

    if (user.account_status !== "pending_deletion") {
      return res.status(400).json({
        success: false,
        code: "ACCOUNT_NOT_PENDING_DELETION",
        message: "This account is not scheduled for deletion.",
      });
    }

    /*
     * Token must belong to the current account state.
     */
    const tokenVersion = decoded.tokenVersion ?? 0;

    const currentTokenVersion = user.token_version ?? 0;

    if (tokenVersion !== currentTokenVersion) {
      return res.status(401).json({
        success: false,
        code: "INVALID_REACTIVATION_TOKEN",
        message:
          "This reactivation request is no longer valid. Please log in again.",
      });
    }

    /*
     * Recovery is only allowed before the
     * 30-day deadline.
     */
    if (!user.deletion_scheduled_at) {
      return res.status(400).json({
        success: false,
        message: "Account deletion date is missing.",
      });
    }

    const deletionDate = new Date(user.deletion_scheduled_at);

    if (deletionDate.getTime() <= Date.now()) {
      return res.status(410).json({
        success: false,
        code: "ACCOUNT_DELETION_PERIOD_EXPIRED",
        message: "The account recovery period has expired.",
        canReactivate: false,
      });
    }

    /*
     * Increment once more.
     *
     * This ensures any older access/refresh tokens
     * from before deletion cannot become valid again.
     */
    const newTokenVersion = currentTokenVersion + 1;

    // Reactivate user
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        account_status: "active",

        deletion_requested_at: null,

        deletion_scheduled_at: null,

        token_version: newTokenVersion,

        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("account_status", "pending_deletion")
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    /*
     * Mark scheduled deletion request as cancelled.
     *
     * If this logging update fails, we don't undo
     * account reactivation.
     */
    const { error: deletionRequestUpdateError } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "cancelled",

        cancelled_at: new Date().toISOString(),

        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "scheduled");

    if (deletionRequestUpdateError) {
      console.error(
        "Unable to mark deletion request as cancelled:",
        deletionRequestUpdateError,
      );
    }

    /*
     * Account is ACTIVE now.
     * Immediately create normal login tokens.
     */
    const { accessToken, refreshToken } = generateAuthTokens(updatedUser);

    console.log(
      `${updatedUser.user_name || updatedUser.email} reactivated account at ${new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")}`,
    );

    return res.status(200).json({
      success: true,

      code: "ACCOUNT_REACTIVATED",

      message: "Your account has been reactivated successfully.",

      user: {
        id: updatedUser.id,

        user_name: updatedUser.user_name,

        email: updatedUser.email,

        mobile: updatedUser.mobile,

        is_admin: updatedUser.is_admin,

        avatar_id: updatedUser.avatar_id,

        auth_provider: updatedUser.auth_provider,
      },

      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Reactivate account error:", error);

    next(error);
  }
};

/* =========================================================
   EXPORTS
========================================================= */

export {
  login,
  signupInitiate,
  signupVerify,
  refreshToken,
  googleLogin,
  reactivateAccount,
};
