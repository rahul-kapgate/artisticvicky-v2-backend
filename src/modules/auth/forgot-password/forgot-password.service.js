import {
  pool,
} from "../../../config/database.js";

import {
  env,
} from "../../../config/env.js";

import logger from "../../../config/logger.js";


import AppError from "../../../utils/AppError.js";


import {
  generateOtp,
  hashOtp,
  verifyOtp,
} from "../../../utils/otp.js";


import {
  hashPassword,
  verifyPassword,
} from "../../../utils/password.js";


import {
  generateResetToken,
  hashResetToken,
} from "../../../utils/resetToken.js";


import {
  sendForgotPasswordOtpEmail,
  sendPasswordChangedEmail,
} from "../../../services/email/resend.service.js";


import {
  lockEmail,

  findUserByEmail,

  findLatestForgotPasswordOtp,
  countForgotPasswordOtpsSince,
  expireActiveForgotPasswordOtps,

  createForgotPasswordOtp,
  deleteForgotPasswordOtpById,

  getForgotPasswordOtpForUpdate,
  incrementOtpAttempts,
  markOtpVerified,

  revokeActiveResetSessions,
  createResetSession,

  findResetSessionByTokenHash,
  getResetSessionForUpdate,

  updateUserPassword,
  consumeResetSession,
  revokeOtherResetSessions,
} from "./forgot-password.repository.js";

const PURPOSE =
  "forgot_password";


const GENERIC_MESSAGE =
  "If an account exists for this email, a verification code has been sent.";


const addMinutes = (
  date,
  minutes
) => {
  return new Date(
    date.getTime() +
      minutes *
        60 *
        1000
  );
};


const isExpired = (
  date
) => {
  return (
    new Date(date).getTime() <=
    Date.now()
  );
};


/*
|--------------------------------------------------------------------------
| REQUEST PASSWORD RESET
|--------------------------------------------------------------------------
|
| Email -> OTP
|
*/
export const requestPasswordReset =
  async ({
    email,
  }) => {
    const client =
      await pool.connect();


    let emailPayload =
      null;


    try {
      await client.query(
        "BEGIN"
      );


      /*
       * Prevent concurrent requests
       * for the same email.
       */
      await lockEmail(
        client,
        email
      );


      const user =
        await findUserByEmail(
          email,
          client
        );


      /*
       * SECURITY:
       *
       * Do NOT expose whether the
       * account exists.
       *
       * If password_hash is null,
       * this may be a Google-only account.
       */
      if (
        !user ||
        !user.password_hash
      ) {
        await client.query(
          "COMMIT"
        );

        return {
          message:
            GENERIC_MESSAGE,
        };
      }


      /*
       * Check resend cooldown.
       */
      const latestOtp =
        await findLatestForgotPasswordOtp(
          user.id,
          client
        );


      if (latestOtp) {
        const elapsedSeconds =
          Math.floor(
            (
              Date.now() -
              new Date(
                latestOtp.created_at
              ).getTime()
            ) /
              1000
          );


        if (
          elapsedSeconds <
          env
            .otpResendCooldownSeconds
        ) {
          await client.query(
            "COMMIT"
          );

          /*
           * Same response intentionally.
           */
          return {
            message:
              GENERIC_MESSAGE,
          };
        }
      }


      /*
       * Maximum reset requests per hour.
       */
      const oneHourAgo =
        new Date(
          Date.now() -
            60 *
              60 *
              1000
        );


      const hourlyCount =
        await countForgotPasswordOtpsSince(
          user.id,
          oneHourAgo,
          client
        );


      if (
        hourlyCount >=
        env.passwordResetMaxPerHour
      ) {
        await client.query(
          "COMMIT"
        );

        return {
          message:
            GENERIC_MESSAGE,
        };
      }


      /*
       * Expire previous active OTP.
       */
      await expireActiveForgotPasswordOtps(
        user.id,
        client
      );


      const otp =
        generateOtp();


      /*
       * HMAC OTP.
       *
       * Never store raw OTP.
       */
      const otpHash =
        hashOtp({
          otp,

          ownerId:
            user.id,

          purpose:
            PURPOSE,
        });


      const expiresAt =
        addMinutes(
          new Date(),

          env.otpExpiryMinutes
        );


      const otpRecord =
        await createForgotPasswordOtp(
          {
            userId:
              user.id,

            otpHash,

            expiresAt,
          },

          client
        );


      await client.query(
        "COMMIT"
      );


      /*
       * Email is sent AFTER transaction.
       */
      emailPayload = {
        email:
          user.email,

        name:
          user.name,

        otp,

        otpId:
          otpRecord.otp_id,
      };
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Ignore rollback failure
      }

      throw error;
    } finally {
      client.release();
    }


    /*
     * External API calls should not keep
     * DB transactions open.
     */
    if (emailPayload) {
      try {
        await sendForgotPasswordOtpEmail(
          emailPayload
        );
      } catch (error) {
        logger.error(
          {
            err:
              error,

            otpId:
              emailPayload.otpId,
          },

          "Forgot password OTP email failed"
        );


        /*
         * Email failed.
         *
         * Delete OTP because user never
         * received it.
         */
        try {
          await deleteForgotPasswordOtpById(
            emailPayload.otpId
          );
        } catch (
          cleanupError
        ) {
          logger.error(
            {
              err:
                cleanupError,

              otpId:
                emailPayload.otpId,
            },

            "Failed to cleanup forgot password OTP"
          );
        }
      }
    }


    return {
      message:
        GENERIC_MESSAGE,
    };
  };


/*
|--------------------------------------------------------------------------
| VERIFY PASSWORD RESET OTP
|--------------------------------------------------------------------------
|
| OTP -> short-lived resetToken
|
*/
export const verifyPasswordResetOtp =
  async ({
    email,
    otp,
  }) => {
    /*
     * Generate token before DB transaction.
     */
    const resetToken =
      generateResetToken();


    const tokenHash =
      hashResetToken(
        resetToken
      );


    const client =
      await pool.connect();


    let committed =
      false;


    try {
      await client.query(
        "BEGIN"
      );


      await lockEmail(
        client,
        email
      );


      const user =
        await findUserByEmail(
          email,
          client
        );


      if (
        !user ||
        !user.password_hash
      ) {
        throw new AppError(
          "Invalid or expired verification code.",
          400,
          {
            code:
              "INVALID_OR_EXPIRED_OTP",
          }
        );
      }


      const otpRecord =
        await getForgotPasswordOtpForUpdate(
          user.id,
          client
        );


      if (
        !otpRecord ||
        otpRecord.verified_at ||
        isExpired(
          otpRecord.expires_at
        )
      ) {
        throw new AppError(
          "Invalid or expired verification code.",
          400,
          {
            code:
              "INVALID_OR_EXPIRED_OTP",
          }
        );
      }


      /*
       * Maximum OTP attempts.
       */
      if (
        otpRecord.attempts >=
        env.otpMaxAttempts
      ) {
        throw new AppError(
          "Invalid or expired verification code.",
          400,
          {
            code:
              "INVALID_OR_EXPIRED_OTP",
          }
        );
      }


      const validOtp =
        verifyOtp({
          otp,

          ownerId:
            user.id,

          purpose:
            PURPOSE,

          expectedHash:
            otpRecord.otp_hash,
        });


      /*
       * WRONG OTP
       */
      if (!validOtp) {
        await incrementOtpAttempts(
          otpRecord.otp_id,
          client
        );


        /*
         * Important:
         *
         * Commit failed attempt.
         * Otherwise rollback would undo
         * attempts++.
         */
        await client.query(
          "COMMIT"
        );


        committed =
          true;


        throw new AppError(
          "Invalid or expired verification code.",
          400,
          {
            code:
              "INVALID_OR_EXPIRED_OTP",
          }
        );
      }


      /*
       * Correct OTP.
       */
      await markOtpVerified(
        otpRecord.otp_id,
        client
      );


      /*
       * Invalidate previous reset sessions.
       */
      await revokeActiveResetSessions(
        user.id,
        client
      );


      const expiresAt =
        addMinutes(
          new Date(),

          env
            .passwordResetTokenExpiryMinutes
        );


      const resetSession =
        await createResetSession(
          {
            userId:
              user.id,

            tokenHash,

            expiresAt,
          },

          client
        );


      await client.query(
        "COMMIT"
      );


      committed =
        true;


      return {
        resetToken,

        expiresIn:
          env
            .passwordResetTokenExpiryMinutes *
          60,

        resetSessionId:
          resetSession.id,
      };
    } catch (error) {
      if (!committed) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {
          // Ignore rollback failure
        }
      }

      throw error;
    } finally {
      client.release();
    }
  };


/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
|
| resetToken -> new password
|
*/
export const resetPassword =
  async ({
    resetToken,
    newPassword,
  }) => {
    const tokenHash =
      hashResetToken(
        resetToken
      );


    /*
     * Preliminary read before Argon2.
     *
     * Don't hold DB transaction open
     * while hashing.
     */
    const preliminarySession =
      await findResetSessionByTokenHash(
        tokenHash
      );


    if (
      !preliminarySession ||
      preliminarySession.consumed_at ||
      preliminarySession.revoked_at ||
      isExpired(
        preliminarySession.expires_at
      )
    ) {
      throw new AppError(
        "Password reset session is invalid or expired.",
        400,
        {
          code:
            "INVALID_RESET_SESSION",
        }
      );
    }


    /*
     * Don't allow current password again.
     */
    const samePassword =
      await verifyPassword(
        preliminarySession.password_hash,
        newPassword
      );


    if (samePassword) {
      throw new AppError(
        "Choose a password different from your current password.",
        400,
        {
          code:
            "PASSWORD_REUSE",
        }
      );
    }


    /*
     * Argon2id hashing before transaction.
     */
    const newPasswordHash =
      await hashPassword(
        newPassword
      );


    const client =
      await pool.connect();


    let completedSession =
      null;


    try {
      await client.query(
        "BEGIN"
      );


      /*
       * Lock reset session.
       */
      const session =
        await getResetSessionForUpdate(
          tokenHash,
          client
        );


      /*
       * Check again after obtaining lock.
       */
      if (
        !session ||
        session.consumed_at ||
        session.revoked_at ||
        isExpired(
          session.expires_at
        )
      ) {
        throw new AppError(
          "Password reset session is invalid or expired.",
          400,
          {
            code:
              "INVALID_RESET_SESSION",
          }
        );
      }


      /*
       * Password may have changed between
       * preliminary read and lock.
       */
      if (
        session.password_hash !==
        preliminarySession.password_hash
      ) {
        throw new AppError(
          "Password reset session is invalid or expired.",
          400,
          {
            code:
              "INVALID_RESET_SESSION",
          }
        );
      }


      await updateUserPassword(
        {
          userId:
            session.user_id,

          passwordHash:
            newPasswordHash,
        },

        client
      );


      /*
       * Current reset token becomes
       * permanently single-use.
       */
      await consumeResetSession(
        session.id,
        client
      );


      /*
       * Invalidate all other reset sessions.
       */
      await revokeOtherResetSessions(
        {
          userId:
            session.user_id,

          currentSessionId:
            session.id,
        },

        client
      );


      await client.query(
        "COMMIT"
      );


      completedSession =
        session;
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Ignore
      }

      throw error;
    } finally {
      client.release();
    }


    /*
     * Password has already successfully
     * changed at this point.
     *
     * Email failure must NOT undo it.
     */
    try {
      await sendPasswordChangedEmail({
        email:
          completedSession.email,

        name:
          completedSession.name,

        resetSessionId:
          completedSession.id,
      });
    } catch (error) {
      logger.error(
        {
          err:
            error,

          userId:
            completedSession.user_id,

          resetSessionId:
            completedSession.id,
        },

        "Password changed notification email failed"
      );
    }


    return {
      message:
        "Password changed successfully.",
    };
  };