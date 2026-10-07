import bcrypt from "bcrypt";
import crypto from "crypto";

import { supabase } from "../config/supabaseClient.js";

import {
  sendDeleteAccountOtpEmail,
  sendDeletionScheduledEmail,
} from "../services/accountDeletionEmail.service.js";

import { processDueAccountDeletions } from "../services/accountDeletionScheduler.service.js";

export async function requestDeleteAccountOtp(req, res) {
  try {
    /**
     * IMPORTANT:
     *
     * I'm assuming your auth middleware sets:
     *
     * req.user.id
     *
     * If yours uses req.user.userId instead,
     * replace this one line.
     */
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // -------------------------------------------------
    // 1. Get user
    // -------------------------------------------------

    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        `
        id,
        user_name,
        email,
        is_admin,
        account_status
      `,
      )
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // -------------------------------------------------
    // 2. Do not allow admin deletion for now
    // -------------------------------------------------

    if (user.is_admin) {
      return res.status(403).json({
        success: false,
        message:
          "Administrator accounts cannot use self-service account deletion.",
      });
    }

    // -------------------------------------------------
    // 3. Check already scheduled
    // -------------------------------------------------

    if (user.account_status === "pending_deletion") {
      return res.status(409).json({
        success: false,
        code: "ACCOUNT_ALREADY_PENDING_DELETION",
        message: "Your account is already scheduled for deletion.",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "No email address is associated with this account.",
      });
    }

    // -------------------------------------------------
    // 4. Simple OTP resend cooldown
    // -------------------------------------------------

    const { data: recentRequests, error: recentRequestError } = await supabase
      .from("account_deletion_requests")
      .select("id, requested_at")
      .eq("user_id", userId)
      .eq("purpose", "delete")
      .eq("status", "otp_pending")
      .order("requested_at", {
        ascending: false,
      })
      .limit(1);

    if (recentRequestError) {
      console.error(
        "Recent deletion request lookup error:",
        recentRequestError,
      );

      return res.status(500).json({
        success: false,
        message: "Unable to process account deletion request.",
      });
    }

    const recentRequest = recentRequests?.[0];

    if (recentRequest) {
      const requestedAt = new Date(recentRequest.requested_at).getTime();

      const cooldown = 60 * 1000;

      const remaining = cooldown - (Date.now() - requestedAt);

      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(
            remaining / 1000,
          )} seconds before requesting another OTP.`,
        });
      }
    }

    // -------------------------------------------------
    // 5. Expire old OTPs
    // -------------------------------------------------

    const { error: expireError } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "expired",
        otp_hash: null,
        otp_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("purpose", "delete")
      .eq("status", "otp_pending");

    if (expireError) {
      console.error("Expire previous OTP error:", expireError);

      return res.status(500).json({
        success: false,
        message: "Unable to generate verification code.",
      });
    }

    // -------------------------------------------------
    // 6. Generate secure OTP
    // -------------------------------------------------

    const otp = crypto.randomInt(100000, 1000000).toString();

    // Never store plaintext OTP.

    const otpHash = await bcrypt.hash(otp, 10);

    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // -------------------------------------------------
    // 7. Store OTP
    // -------------------------------------------------

    const { error: insertError } = await supabase
      .from("account_deletion_requests")
      .insert({
        user_id: userId,
        purpose: "delete",
        otp_hash: otpHash,
        otp_expires_at: otpExpiresAt.toISOString(),
        otp_attempts: 0,
        status: "otp_pending",
      });

    if (insertError) {
      console.error("Deletion request insert error:", insertError);

      return res.status(500).json({
        success: false,
        message: "Unable to create deletion request.",
      });
    }

    // -------------------------------------------------
    // 8. Send email
    // -------------------------------------------------

    try {
      await sendDeleteAccountOtpEmail({
        email: user.email,
        name: user.user_name,
        otp,
      });
    } catch (emailError) {
      console.error("Deletion OTP email error:", emailError);

      // Don't expose provider details to frontend.

      return res.status(500).json({
        success: false,
        message: "Unable to send verification email. Please try again.",
      });
    }

    // -------------------------------------------------
    // 9. Response
    // -------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Verification code has been sent to your registered email address.",
      expiresIn: 600,
    });
  } catch (error) {
    console.error("Request account deletion OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function verifyDeleteAccountOtp(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { otp } = req.body;

    // -------------------------------------------------
    // 1. Validate OTP
    // -------------------------------------------------

    if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit verification code.",
      });
    }

    // -------------------------------------------------
    // 2. Fetch user
    // -------------------------------------------------

    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        `
        id,
        user_name,
        email,
        is_admin,
        account_status,
        token_version
      `,
      )
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.is_admin) {
      return res.status(403).json({
        success: false,
        message:
          "Administrator accounts cannot use self-service account deletion.",
      });
    }

    if (user.account_status === "pending_deletion") {
      return res.status(409).json({
        success: false,
        code: "ACCOUNT_ALREADY_PENDING_DELETION",
        message: "Your account is already scheduled for deletion.",
      });
    }

    // -------------------------------------------------
    // 3. Get latest OTP request
    // -------------------------------------------------

    const { data: requests, error: requestError } = await supabase
      .from("account_deletion_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("purpose", "delete")
      .eq("status", "otp_pending")
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (requestError) {
      console.error("Deletion OTP lookup error:", requestError);

      return res.status(500).json({
        success: false,
        message: "Unable to verify deletion request.",
      });
    }

    const deletionRequest = requests?.[0];

    if (!deletionRequest) {
      return res.status(400).json({
        success: false,
        message: "No active account deletion verification request found.",
      });
    }

    // -------------------------------------------------
    // 4. Limit OTP attempts
    // -------------------------------------------------

    const MAX_ATTEMPTS = 5;

    if (deletionRequest.otp_attempts >= MAX_ATTEMPTS) {
      await supabase
        .from("account_deletion_requests")
        .update({
          status: "expired",
          otp_hash: null,
          otp_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deletionRequest.id);

      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect attempts. Request a new verification code.",
      });
    }

    // -------------------------------------------------
    // 5. Check expiry
    // -------------------------------------------------

    if (
      !deletionRequest.otp_expires_at ||
      new Date(deletionRequest.otp_expires_at).getTime() <= Date.now()
    ) {
      await supabase
        .from("account_deletion_requests")
        .update({
          status: "expired",
          otp_hash: null,
          otp_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deletionRequest.id);

      return res.status(400).json({
        success: false,
        code: "OTP_EXPIRED",
        message: "Verification code has expired. Request a new one.",
      });
    }

    // -------------------------------------------------
    // 6. Compare OTP
    // -------------------------------------------------

    const isOtpValid = await bcrypt.compare(otp, deletionRequest.otp_hash);

    if (!isOtpValid) {
      const newAttemptCount = deletionRequest.otp_attempts + 1;

      const reachedLimit = newAttemptCount >= MAX_ATTEMPTS;

      await supabase
        .from("account_deletion_requests")
        .update({
          otp_attempts: newAttemptCount,

          ...(reachedLimit
            ? {
                status: "expired",
                otp_hash: null,
                otp_expires_at: null,
              }
            : {}),

          updated_at: new Date().toISOString(),
        })
        .eq("id", deletionRequest.id);

      return res.status(400).json({
        success: false,
        code: reachedLimit ? "OTP_ATTEMPTS_EXCEEDED" : "INVALID_OTP",
        message: reachedLimit
          ? "Too many incorrect attempts. Request a new verification code."
          : "Invalid verification code.",
        attemptsRemaining: Math.max(MAX_ATTEMPTS - newAttemptCount, 0),
      });
    }

    // -------------------------------------------------
    // 7. Calculate 30-day deletion date
    // -------------------------------------------------

    const now = new Date();

    const deletionScheduledAt = new Date(now.getTime() + 1 * 60 * 1000);

    // -------------------------------------------------
    // 8. Mark account pending deletion
    // -------------------------------------------------

    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        account_status: "pending_deletion",

        deletion_requested_at: now.toISOString(),

        deletion_scheduled_at: deletionScheduledAt.toISOString(),

        // Important for session invalidation later.
        token_version: (user.token_version || 0) + 1,

        updated_at: now.toISOString(),
      })
      .eq("id", userId);

    if (updateUserError) {
      console.error("Schedule account deletion error:", updateUserError);

      return res.status(500).json({
        success: false,
        message: "Unable to schedule account deletion.",
      });
    }

    // -------------------------------------------------
    // 9. Mark OTP as completed/scheduled
    // -------------------------------------------------

    const { error: updateRequestError } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "scheduled",

        verified_at: now.toISOString(),

        otp_hash: null,

        otp_expires_at: null,

        updated_at: now.toISOString(),
      })
      .eq("id", deletionRequest.id);

    if (updateRequestError) {
      console.error("Update deletion request error:", updateRequestError);

      /*
       * Account is already pending deletion at this point.
       *
       * Do not undo it automatically just because
       * logging/status update failed.
       */
    }

    // -------------------------------------------------
    // 10. Send scheduled deletion email
    // -------------------------------------------------

    try {
      await sendDeletionScheduledEmail({
        email: user.email,
        name: user.user_name,
        deletionDate: deletionScheduledAt.toISOString(),
      });
    } catch (emailError) {
      /*
       * IMPORTANT:
       *
       * Don't undo deletion because email failed.
       * Account state is more important than notification.
       */

      console.error("Deletion scheduled email error:", emailError);
    }

    // -------------------------------------------------
    // 11. Return response
    // -------------------------------------------------

    return res.status(200).json({
      success: true,

      code: "ACCOUNT_DELETION_SCHEDULED",

      message: "Your account has been scheduled for deletion.",

      deletionRequestedAt: now.toISOString(),

      deletionScheduledAt: deletionScheduledAt.toISOString(),

      recoveryPeriodDays: 30,

      canReactivate: true,
    });
  } catch (error) {
    console.error("Verify account deletion OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export const runAccountDeletionCron = async (req, res) => {
  try {
    if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized nop",
      });
    }

    console.log("[AccountDeletionCron] Started:", new Date().toISOString());

    const result = await processDueAccountDeletions();

    console.log("[AccountDeletionCron] Completed:", result);

    return res.status(200).json({
      success: true,

      message: "Account deletion processing completed.",

      found: result.found,
      deleted: result.deleted,
      failed: result.failed,
    });
  } catch (error) {
    console.error("[AccountDeletionCron] Error:", error);

    return res.status(500).json({
      success: false,
      message: "Account deletion processing failed.",
    });
  }
};
