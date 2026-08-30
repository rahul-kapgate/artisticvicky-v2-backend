import {
  pool,
} from "../config/database.js";

import AppError
  from "../utils/AppError.js";

import {
  verifyAccessToken,
} from "../utils/accessToken.js";

const invalidSession = () =>
  new AppError(
    "Session is invalid or expired.",
    401,
    {
      code:
        "INVALID_SESSION",
    }
  );

export const authenticate =
  async (
    req,
    res,
    next
  ) => {
    const authorization =
      req.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      throw new AppError(
        "Authentication required.",
        401,
        {
          code:
            "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const token =
      authorization.slice(7);

    let payload;

    try {
      payload =
        verifyAccessToken(
          token
        );
    } catch {
      throw invalidSession();
    }

    if (
      payload.type !== "access" ||
      !payload.sub ||
      !payload.sid
    ) {
      throw invalidSession();
    }

    const result =
      await pool.query(
        `
          SELECT
            s.session_id,
            s.user_id,
            s.device_id,
            s.device_name,
            s.platform,
            s.expires_at,
            s.revoked_at,

            u.name,
            u.email,
            u.mobile,
            u.profile_picture,
            u.password_changed_at

          FROM public.user_sessions s

          INNER JOIN public.users u
            ON u.id = s.user_id

          WHERE
            s.session_id = $1

            AND s.user_id = $2

          LIMIT 1
        `,
        [
          payload.sid,
          payload.sub,
        ]
      );

    const session =
      result.rows[0];

    if (
      !session ||
      session.revoked_at ||
      new Date(
        session.expires_at
      ).getTime() <=
        Date.now()
    ) {
      throw invalidSession();
    }

    /*
     * JWT generated before password reset.
     */
    if (
      session.password_changed_at &&
      payload.iat * 1000 <
        new Date(
          session.password_changed_at
        ).getTime()
    ) {
      throw invalidSession();
    }

    req.user = {
      id:
        session.user_id,

      name:
        session.name,

      email:
        session.email,

      mobile:
        session.mobile,

      profilePicture:
        session.profile_picture,
    };

    req.authSession = {
      id:
        session.session_id,

      deviceId:
        session.device_id,

      deviceName:
        session.device_name,

      platform:
        session.platform,
    };

    next();
  };