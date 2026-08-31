import { OAuth2Client } from "google-auth-library";

import { pool } from "../../../config/database.js";

import { env } from "../../../config/env.js";

import AppError from "../../../utils/AppError.js";

import { generateAccessToken } from "../../../utils/accessToken.js";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../../utils/refreshToken.js";

import {
  revokeSameDeviceSession,
  createSession,
} from "../login/login.repository.js";

import {
  findUserByGoogleIdForUpdate,
  findUserByEmailForUpdate,
  linkGoogleAccount,
  createGoogleUser,
} from "./google.repository.js";

const googleClient = new OAuth2Client();

const googleAuthFailed = () =>
  new AppError("Google authentication failed.", 401, {
    code: "GOOGLE_AUTH_FAILED",
  });

const addDays = (date, days) => {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

/*
 * Google is authoritative for:
 *
 * 1. @gmail.com
 * 2. Google Workspace where
 *    email_verified=true and hd exists.
 */
const isGoogleAuthoritativeForEmail = ({
  email,
  emailVerified,
  hostedDomain,
}) => {
  if (email.endsWith("@gmail.com")) {
    return true;
  }

  return emailVerified === true && Boolean(hostedDomain);
};

const verifyGoogleToken = async (idToken) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,

      audience: env.googleWebClientId,
    });

    return ticket.getPayload();
  } catch {
    throw googleAuthFailed();
  }
};

export const authenticateWithGoogle = async ({
  idToken,

  deviceId,
  deviceName,
  platform,

  ipAddress,
  userAgent,
}) => {
  /*
   * Verify with Google BEFORE
   * opening a DB transaction.
   */
  const payload = await verifyGoogleToken(idToken);

  if (
    !payload ||
    !payload.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    throw googleAuthFailed();
  }

  const googleId = payload.sub;

  const email = payload.email.trim().toLowerCase();

  const name = (payload.name?.trim() || email.split("@")[0] || "User").slice(
    0,
    100,
  );

  const profilePicture = payload.picture ?? null;

  const googleAuthoritative = isGoogleAuthoritativeForEmail({
    email,

    emailVerified: payload.email_verified,

    hostedDomain: payload.hd,
  });

  const refreshToken = generateRefreshToken();

  const refreshTokenHash = hashRefreshToken(refreshToken);

  const expiresAt = addDays(new Date(), env.sessionExpiryDays);

  const client = await pool.connect();

  let user;
  let session;

  try {
    await client.query("BEGIN");

    /*
     * Prevent duplicate Google account
     * creation during simultaneous login.
     */
    await client.query(
      `
          SELECT
            pg_advisory_xact_lock(
              hashtext($1)
            )
        `,
      [`google:${googleId}`],
    );

    /*
     * First lookup by Google's stable ID.
     */
    user = await findUserByGoogleIdForUpdate(googleId, client);

    if (!user) {
      /*
       * Serialize operations involving
       * this email.
       */
      await client.query(
        `
            SELECT
              pg_advisory_xact_lock(
                hashtext($1)
              )
          `,
        [`email:${email}`],
      );

      const emailUser = await findUserByEmailForUpdate(email, client);

      if (emailUser) {
        /*
         * Email already linked to a
         * different Google account.
         */
        if (emailUser.google_id && emailUser.google_id !== googleId) {
          throw new AppError(
            "This email is already linked to another Google account.",
            409,
            {
              code: "GOOGLE_ACCOUNT_CONFLICT",
            },
          );
        }

        /*
         * Existing password account.
         *
         * Auto-link only when Google
         * is authoritative for the email.
         */
        if (!emailUser.google_id) {
          if (!googleAuthoritative) {
            throw new AppError(
              "Sign in with your password first to link this Google account.",
              409,
              {
                code: "GOOGLE_LINK_REQUIRES_PASSWORD",
              },
            );
          }

          user = await linkGoogleAccount(
            {
              userId: emailUser.id,

              googleId,
            },
            client,
          );
        } else {
          user = emailUser;
        }
      } else {
        /*
         * Completely new user.
         *
         * Google authentication acts as
         * registration, so no OTP is
         * required here.
         */
        user = await createGoogleUser(
          {
            name,
            email,
            googleId,
            profilePicture,
          },
          client,
        );
      }
    }

    /*
     * Same session behavior as normal
     * email/password login.
     */
    await client.query(
      `
          SELECT
            pg_advisory_xact_lock(
              hashtext($1)
            )
        `,
      [`${user.id}:${deviceId}`],
    );

    await revokeSameDeviceSession(
      {
        userId: user.id,

        deviceId,
      },
      client,
    );

    session = await createSession(
      {
        userId: user.id,

        refreshTokenHash,

        expiresAt,

        deviceId,
        deviceName,
        platform,

        ipAddress,
        userAgent,
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }

    throw error;
  } finally {
    client.release();
  }

  const accessToken = generateAccessToken({
    userId: user.id,

    sessionId: session.session_id,
  });

  return {
    user: {
      id: user.id,

      name: user.name,

      email: user.email,

      mobile: user.mobile,

      profilePicture: user.profile_picture,

      authProvider: user.auth_provider,
    },

    accessToken,

    refreshToken,

    accessTokenExpiresIn: env.accessTokenExpiryMinutes * 60,

    sessionExpiresAt: session.expires_at,

    platform: session.platform,
  };
};
