import {
  pool,
} from "../../../config/database.js";

export const findUserByEmail = async (
  email,
  db = pool
) => {
  const result = await db.query(
    `
      SELECT
        id,
        name,
        email,
        mobile,
        profile_picture,
        auth_provider,
        password_hash,
        password_changed_at

      FROM public.users

      WHERE LOWER(email) = LOWER($1)

      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
};

export const revokeSameDeviceSession = async (
  {
    userId,
    deviceId,
  },
  client
) => {
  await client.query(
    `
      UPDATE public.user_sessions

      SET
        revoked_at = NOW(),
        revoked_reason = 'same_device_login',
        updated_at = NOW()

      WHERE user_id = $1
        AND device_id = $2
        AND revoked_at IS NULL
    `,
    [
      userId,
      deviceId,
    ]
  );
};

export const createSession = async (
  {
    userId,
    refreshTokenHash,
    expiresAt,
    deviceId,
    deviceName,
    platform,
    ipAddress,
    userAgent,
  },
  client
) => {
  const result = await client.query(
    `
      INSERT INTO public.user_sessions
      (
        user_id,
        refresh_token_hash,
        expires_at,

        device_id,
        device_name,
        platform,

        last_used_at,
        ip_address,
        user_agent
      )

      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NOW(),
        $7,
        $8
      )

      RETURNING
        session_id,
        user_id,
        device_id,
        device_name,
        platform,
        expires_at,
        created_at
    `,
    [
      userId,
      refreshTokenHash,
      expiresAt,

      deviceId,
      deviceName ?? null,
      platform,

      ipAddress ?? null,
      userAgent ?? null,
    ]
  );

  return result.rows[0];
};