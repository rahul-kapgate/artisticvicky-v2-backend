import { pool } from "../../config/database.js";
import { env } from "../../config/env.js";

import AppError from "../../utils/AppError.js";

import { generateOtp, hashOtp, verifyOtp } from "../../utils/otp.js";

import { hashPassword } from "../../utils/password.js";

import {
  lockEmail,
  findUserByEmail,
  findUserByMobile,
  findPendingUserByEmailForUpdate,
  findPendingUserByIdForUpdate,
  createPendingUser,
  updatePendingUser,
  findLatestRegistrationOtp,
  deletePendingRegistrationOtps,
  createRegistrationOtp,
  deleteOtpById,
  getRegistrationVerificationForUpdate,
  incrementOtpAttempts,
  createUser,
  transferOtpToUser,
  deletePendingUser,
} from "./auth.repository.js";

import { sendRegistrationOtpEmail } from "../../services/email/resend.service.js";

const PURPOSE = "registration";

const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60 * 1000);
};

const secondsSince = (date) => {
  return Math.floor((Date.now() - new Date(date).getTime()) / 1000);
};

const checkUserConflicts = async ({ email, mobile }, db) => {
  const existingEmail = await findUserByEmail(email, db);

  if (existingEmail) {
    throw new AppError("An account already exists with this email", 409, {
      code: "EMAIL_ALREADY_REGISTERED",
    });
  }

  if (mobile) {
    const existingMobile = await findUserByMobile(mobile, db);

    if (existingMobile) {
      throw new AppError(
        "An account already exists with this mobile number",
        409,
        {
          code: "MOBILE_ALREADY_REGISTERED",
        },
      );
    }
  }
};

export const startRegistration = async ({ name, email, mobile, password }) => {
  /*
   * Hashing is intentionally performed before
   * starting the transaction.
   *
   * Argon2 is expensive by design and we should not
   * keep a DB transaction open while hashing.
   */
  const passwordHash = await hashPassword(password);

  const otp = generateOtp();

  const client = await pool.connect();

  let pendingUser;
  let verification;

  try {
    await client.query("BEGIN");

    /*
     * Serializes concurrent registration attempts
     * for the same email.
     */
    await lockEmail(client, email);

    /*
     * Re-check inside the transaction.
     */
    await checkUserConflicts(
      {
        email,
        mobile,
      },
      client,
    );

    const existingPendingUser = await findPendingUserByEmailForUpdate(
      email,
      client,
    );

    /*
     * Protect against registration endpoint spam.
     */
    if (existingPendingUser) {
      const latestOtp = await findLatestRegistrationOtp(
        existingPendingUser.id,
        client,
      );

      if (latestOtp) {
        const elapsed = secondsSince(latestOtp.created_at);

        if (elapsed < env.otpResendCooldownSeconds) {
          const retryAfter = env.otpResendCooldownSeconds - elapsed;

          throw new AppError(
            `OTP already sent. Try again in ${retryAfter} seconds.`,
            429,
            {
              code: "OTP_COOLDOWN",
              retryAfter,
            },
          );
        }
      }
    }

    const now = new Date();

    const pendingExpiresAt = addMinutes(now, env.pendingUserExpiryMinutes);

    if (existingPendingUser) {
      pendingUser = await updatePendingUser(
        existingPendingUser.id,
        {
          name,
          email,
          mobile,
          passwordHash,
          expiresAt: pendingExpiresAt,
        },
        client,
      );
    } else {
      pendingUser = await createPendingUser(
        {
          name,
          email,
          mobile,
          passwordHash,
          expiresAt: pendingExpiresAt,
        },
        client,
      );
    }

    /*
     * Only one active registration OTP.
     */
    await deletePendingRegistrationOtps(pendingUser.id, client);

    const otpHash = hashOtp({
      otp,
      ownerId: pendingUser.id,
      purpose: PURPOSE,
    });

    const otpExpiresAt = addMinutes(now, env.otpExpiryMinutes);

    verification = await createRegistrationOtp(
      {
        pendingUserId: pendingUser.id,

        otpHash,

        expiresAt: otpExpiresAt,
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }

  /*
   * Important:
   * Never call an external email API while holding
   * the PostgreSQL transaction open.
   */
  try {
    await sendRegistrationOtpEmail({
      email: pendingUser.email,

      name: pendingUser.name,

      otp,

      verificationId: verification.otp_id,
    });
  } catch {
    /*
     * The email was not delivered.
     *
     * Remove the OTP so a user cannot verify using
     * a code that was never successfully sent.
     */
    await deleteOtpById(verification.otp_id);

    throw new AppError(
      "Unable to send verification email. Please try again.",
      503,
      {
        code: "OTP_EMAIL_FAILED",
      },
    );
  }

  return {
    pendingUserId: pendingUser.id,

    verificationId: verification.otp_id,

    expiresIn: env.otpExpiryMinutes * 60,

    resendAfter: env.otpResendCooldownSeconds,
  };
};

export const verifyRegistration = async ({ verificationId, otp }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const verification = await getRegistrationVerificationForUpdate(
      verificationId,
      client,
    );

    if (!verification) {
      throw new AppError("Invalid or expired verification request", 400, {
        code: "INVALID_VERIFICATION",
      });
    }

    if (verification.verified_at) {
      throw new AppError("OTP has already been used", 400, {
        code: "OTP_ALREADY_USED",
      });
    }

    const now = Date.now();

    if (new Date(verification.pending_expires_at).getTime() <= now) {
      throw new AppError(
        "Registration session has expired. Please register again.",
        410,
        {
          code: "REGISTRATION_EXPIRED",
        },
      );
    }

    if (new Date(verification.otp_expires_at).getTime() <= now) {
      throw new AppError("OTP has expired. Please request a new OTP.", 410, {
        code: "OTP_EXPIRED",
      });
    }

    if (verification.attempts >= env.otpMaxAttempts) {
      throw new AppError(
        "Maximum OTP attempts exceeded. Request a new OTP.",
        429,
        {
          code: "OTP_ATTEMPTS_EXCEEDED",
        },
      );
    }

    const otpValid = verifyOtp({
      otp,

      ownerId: verification.pending_user_id,

      purpose: PURPOSE,

      expectedHash: verification.otp_hash,
    });

    if (!otpValid) {
      const updated = await incrementOtpAttempts(verification.otp_id, client);

      const remaining = Math.max(0, env.otpMaxAttempts - updated.attempts);

      /*
       * Commit the failed attempt.
       * If we roll back here, attempts would never increase.
       */
      await client.query("COMMIT");

      throw new AppError(
        remaining > 0
          ? `Invalid OTP. ${remaining} attempts remaining.`
          : "Maximum OTP attempts exceeded. Request a new OTP.",
        remaining > 0 ? 400 : 429,
        {
          code: remaining > 0 ? "INVALID_OTP" : "OTP_ATTEMPTS_EXCEEDED",
        },
      );
    }

    /*
     * Check again immediately before creating user.
     */
    await checkUserConflicts(
      {
        email: verification.email,

        mobile: verification.mobile,
      },
      client,
    );

    const user = await createUser(
      {
        name: verification.name,

        email: verification.email,

        mobile: verification.mobile,

        passwordHash: verification.password_hash,
      },
      client,
    );

    /*
     * Transfer OTP ownership before deleting
     * pending_users.
     */
    await transferOtpToUser(
      {
        otpId: verification.otp_id,

        userId: user.id,
      },
      client,
    );

    await deletePendingUser(verification.pending_user_id, client);

    await client.query("COMMIT");

    return user;
  } catch (error) {
    /*
     * verifyRegistration can intentionally commit
     * invalid-attempt increments before throwing.
     */
    try {
      await client.query("ROLLBACK");
    } catch {
      // Transaction already committed.
    }

    /*
     * Handle DB uniqueness race.
     */
    if (error.code === "23505") {
      throw new AppError("Account already exists", 409, {
        code: "ACCOUNT_ALREADY_EXISTS",
      });
    }

    throw error;
  } finally {
    client.release();
  }
};

export const resendRegistrationOtp = async ({ pendingUserId }) => {
  const otp = generateOtp();

  const client = await pool.connect();

  let pendingUser;
  let verification;

  try {
    await client.query("BEGIN");

    pendingUser = await findPendingUserByIdForUpdate(pendingUserId, client);

    if (!pendingUser) {
      throw new AppError("Registration session not found", 404, {
        code: "REGISTRATION_NOT_FOUND",
      });
    }

    if (new Date(pendingUser.expires_at).getTime() <= Date.now()) {
      throw new AppError(
        "Registration session has expired. Please register again.",
        410,
        {
          code: "REGISTRATION_EXPIRED",
        },
      );
    }

    const latestOtp = await findLatestRegistrationOtp(pendingUserId, client);

    if (latestOtp) {
      const elapsed = secondsSince(latestOtp.created_at);

      if (elapsed < env.otpResendCooldownSeconds) {
        const retryAfter = env.otpResendCooldownSeconds - elapsed;

        throw new AppError(
          `Please wait ${retryAfter} seconds before requesting another OTP.`,
          429,
          {
            code: "OTP_COOLDOWN",

            retryAfter,
          },
        );
      }
    }

    await deletePendingRegistrationOtps(pendingUserId, client);

    const otpHash = hashOtp({
      otp,

      ownerId: pendingUserId,

      purpose: PURPOSE,
    });

    verification = await createRegistrationOtp(
      {
        pendingUserId,

        otpHash,

        expiresAt: addMinutes(new Date(), env.otpExpiryMinutes),
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }

  try {
    await sendRegistrationOtpEmail({
      email: pendingUser.email,

      name: pendingUser.name,

      otp,

      verificationId: verification.otp_id,
    });
  } catch {
    await deleteOtpById(verification.otp_id);

    throw new AppError(
      "Unable to send verification email. Please try again.",
      503,
      {
        code: "OTP_EMAIL_FAILED",
      },
    );
  }

  return {
    verificationId: verification.otp_id,

    expiresIn: env.otpExpiryMinutes * 60,

    resendAfter: env.otpResendCooldownSeconds,
  };
};
