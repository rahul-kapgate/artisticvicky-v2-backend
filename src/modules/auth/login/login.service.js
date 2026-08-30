import {
  pool,
} from "../../../config/database.js";

import {
  env,
} from "../../../config/env.js";

import AppError
  from "../../../utils/AppError.js";

import {
  verifyPassword,
} from "../../../utils/password.js";

import {
  generateAccessToken,
} from "../../../utils/accessToken.js";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../../utils/refreshToken.js";

import {
  findUserByEmail,
  revokeSameDeviceSession,
  createSession,
} from "./login.repository.js";

const invalidCredentials = () =>
  new AppError(
    "Invalid email or password.",
    401,
    {
      code: "INVALID_CREDENTIALS",
    }
  );

const addDays = (
  date,
  days
) =>
  new Date(
    date.getTime() +
      days * 24 * 60 * 60 * 1000
  );

export const loginUser = async ({
  email,
  password,

  deviceId,
  deviceName,
  platform,

  ipAddress,
  userAgent,
}) => {
  const user =
    await findUserByEmail(email);

  if (
    !user ||
    !user.password_hash
  ) {
    throw invalidCredentials();
  }

  const validPassword =
    await verifyPassword(
      user.password_hash,
      password
    );

  if (!validPassword) {
    throw invalidCredentials();
  }

  const refreshToken =
    generateRefreshToken();

  const refreshTokenHash =
    hashRefreshToken(
      refreshToken
    );

  const expiresAt =
    addDays(
      new Date(),
      env.sessionExpiryDays
    );

  const client =
    await pool.connect();

  let session;

  try {
    await client.query("BEGIN");

    /*
     * Prevent two simultaneous logins
     * for same user/device.
     */
    await client.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [
        `${user.id}:${deviceId}`,
      ]
    );

    await revokeSameDeviceSession(
      {
        userId: user.id,
        deviceId,
      },
      client
    );

    session =
      await createSession(
        {
          userId:
            user.id,

          refreshTokenHash,

          expiresAt,

          deviceId,
          deviceName,
          platform,

          ipAddress,
          userAgent,
        },
        client
      );

    await client.query("COMMIT");
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }

  const accessToken =
    generateAccessToken({
      userId:
        user.id,

      sessionId:
        session.session_id,
    });

  return {
    user: {
      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      mobile:
        user.mobile,

      profilePicture:
        user.profile_picture,

      authProvider:
        user.auth_provider,
    },

    accessToken,

    refreshToken,

    accessTokenExpiresIn:
      env.accessTokenExpiryMinutes *
      60,

    sessionExpiresAt:
      session.expires_at,

    platform:
      session.platform,
  };
};