import {
  pool,
} from "../../../config/database.js";

import {
  env,
} from "../../../config/env.js";

import AppError
  from "../../../utils/AppError.js";

import {
  generateAccessToken,
} from "../../../utils/accessToken.js";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../../utils/refreshToken.js";

import {
  getSessionForRefresh,
  rotateRefreshToken,
  revokeRefreshSession,
} from "./refresh-token.repository.js";

const invalidSession = () =>
  new AppError(
    "Session is invalid or expired.",
    401,
    {
      code:
        "INVALID_SESSION",
    }
  );

export const refreshSession =
  async ({
    refreshToken,
    ipAddress,
    userAgent,
  }) => {
    if (!refreshToken) {
      throw invalidSession();
    }

    const oldHash =
      hashRefreshToken(
        refreshToken
      );

    const newRefreshToken =
      generateRefreshToken();

    const newHash =
      hashRefreshToken(
        newRefreshToken
      );

    const client =
      await pool.connect();

    let session;
    let committed = false;

    try {
      await client.query(
        "BEGIN"
      );

      session =
        await getSessionForRefresh(
          oldHash,
          client
        );

      if (
        !session ||
        session.revoked_at
      ) {
        throw invalidSession();
      }

      if (
        new Date(
          session.expires_at
        ).getTime() <=
        Date.now()
      ) {
        await revokeRefreshSession(
          {
            sessionId:
              session.session_id,

            reason:
              "expired",
          },
          client
        );

        await client.query(
          "COMMIT"
        );

        committed = true;

        throw invalidSession();
      }

      /*
       * Password changed after login.
       */
      if (
        session.password_changed_at &&
        new Date(
          session.password_changed_at
        ).getTime() >
          new Date(
            session.created_at
          ).getTime()
      ) {
        await revokeRefreshSession(
          {
            sessionId:
              session.session_id,

            reason:
              "password_changed",
          },
          client
        );

        await client.query(
          "COMMIT"
        );

        committed = true;

        throw invalidSession();
      }

      await rotateRefreshToken(
        {
          sessionId:
            session.session_id,

          refreshTokenHash:
            newHash,

          ipAddress,
          userAgent,
        },
        client
      );

      await client.query(
        "COMMIT"
      );

      committed = true;
    } catch (error) {
      if (!committed) {
        await client.query(
          "ROLLBACK"
        );
      }

      throw error;
    } finally {
      client.release();
    }

    const accessToken =
      generateAccessToken({
        userId:
          session.user_id,

        sessionId:
          session.session_id,
      });

    return {
      accessToken,

      refreshToken:
        newRefreshToken,

      accessTokenExpiresIn:
        env.accessTokenExpiryMinutes *
        60,

      sessionExpiresAt:
        session.expires_at,

      platform:
        session.platform,
    };
  };