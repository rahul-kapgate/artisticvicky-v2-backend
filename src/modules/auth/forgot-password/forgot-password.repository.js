import {
  pool,
} from "../../../config/database.js";


export const lockEmail = async (
  client,
  email
) => {
  await client.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext($1)
      )
    `,
    [email]
  );
};


export const findUserByEmail = async (
  email,
  db = pool
) => {
  const result =
    await db.query(
      `
        SELECT
          id,
          name,
          email,
          password_hash,
          auth_provider,
          password_changed_at
        FROM public.users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

  return result.rows[0] ?? null;
};


export const findLatestForgotPasswordOtp =
  async (
    userId,
    db = pool
  ) => {
    const result =
      await db.query(
        `
          SELECT
            otp_id,
            created_at,
            expires_at,
            attempts,
            verified_at
          FROM public.otp_verifications
          WHERE user_id = $1
            AND purpose = 'forgot_password'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [userId]
      );

    return result.rows[0] ?? null;
  };


export const countForgotPasswordOtpsSince =
  async (
    userId,
    since,
    db = pool
  ) => {
    const result =
      await db.query(
        `
          SELECT
            COUNT(*)::integer AS count
          FROM public.otp_verifications
          WHERE user_id = $1
            AND purpose = 'forgot_password'
            AND created_at >= $2
        `,
        [
          userId,
          since,
        ]
      );

    return result.rows[0].count;
  };


export const expireActiveForgotPasswordOtps =
  async (
    userId,
    client
  ) => {
    await client.query(
      `
        UPDATE public.otp_verifications

        SET expires_at = NOW()

        WHERE user_id = $1
          AND purpose = 'forgot_password'
          AND verified_at IS NULL
          AND expires_at > NOW()
      `,
      [userId]
    );
  };


export const createForgotPasswordOtp =
  async (
    {
      userId,
      otpHash,
      expiresAt,
    },
    client
  ) => {
    const result =
      await client.query(
        `
          INSERT INTO public.otp_verifications
          (
            user_id,
            pending_user_id,
            purpose,
            otp_hash,
            expires_at
          )

          VALUES
          (
            $1,
            NULL,
            'forgot_password',
            $2,
            $3
          )

          RETURNING
            otp_id,
            user_id,
            expires_at,
            created_at
        `,
        [
          userId,
          otpHash,
          expiresAt,
        ]
      );

    return result.rows[0];
  };


export const deleteForgotPasswordOtpById =
  async (
    otpId,
    db = pool
  ) => {
    await db.query(
      `
        DELETE FROM public.otp_verifications

        WHERE otp_id = $1
          AND purpose = 'forgot_password'
          AND verified_at IS NULL
      `,
      [otpId]
    );
  };


export const getForgotPasswordOtpForUpdate =
  async (
    userId,
    client
  ) => {
    const result =
      await client.query(
        `
          SELECT
            otp_id,
            user_id,
            otp_hash,
            expires_at,
            attempts,
            verified_at,
            created_at

          FROM public.otp_verifications

          WHERE user_id = $1
            AND purpose = 'forgot_password'
            AND verified_at IS NULL

          ORDER BY created_at DESC

          LIMIT 1

          FOR UPDATE
        `,
        [userId]
      );

    return result.rows[0] ?? null;
  };


export const incrementOtpAttempts =
  async (
    otpId,
    client
  ) => {
    const result =
      await client.query(
        `
          UPDATE public.otp_verifications

          SET attempts = attempts + 1

          WHERE otp_id = $1

          RETURNING attempts
        `,
        [otpId]
      );

    return result.rows[0];
  };


export const markOtpVerified =
  async (
    otpId,
    client
  ) => {
    await client.query(
      `
        UPDATE public.otp_verifications

        SET verified_at = NOW()

        WHERE otp_id = $1
          AND verified_at IS NULL
      `,
      [otpId]
    );
  };


export const revokeActiveResetSessions =
  async (
    userId,
    client
  ) => {
    await client.query(
      `
        UPDATE public.password_reset_sessions

        SET revoked_at = NOW()

        WHERE user_id = $1
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [userId]
    );
  };


export const createResetSession =
  async (
    {
      userId,
      tokenHash,
      expiresAt,
    },
    client
  ) => {
    const result =
      await client.query(
        `
          INSERT INTO public.password_reset_sessions
          (
            user_id,
            token_hash,
            expires_at
          )

          VALUES
          (
            $1,
            $2,
            $3
          )

          RETURNING
            id,
            user_id,
            expires_at,
            created_at
        `,
        [
          userId,
          tokenHash,
          expiresAt,
        ]
      );

    return result.rows[0];
  };


export const findResetSessionByTokenHash =
  async (
    tokenHash,
    db = pool
  ) => {
    const result =
      await db.query(
        `
          SELECT
            prs.id,
            prs.user_id,
            prs.expires_at,
            prs.consumed_at,
            prs.revoked_at,

            u.name,
            u.email,
            u.password_hash

          FROM public.password_reset_sessions prs

          INNER JOIN public.users u
            ON u.id = prs.user_id

          WHERE prs.token_hash = $1

          LIMIT 1
        `,
        [tokenHash]
      );

    return result.rows[0] ?? null;
  };


export const getResetSessionForUpdate =
  async (
    tokenHash,
    client
  ) => {
    const result =
      await client.query(
        `
          SELECT
            prs.id,
            prs.user_id,
            prs.expires_at,
            prs.consumed_at,
            prs.revoked_at,

            u.name,
            u.email,
            u.password_hash

          FROM public.password_reset_sessions prs

          INNER JOIN public.users u
            ON u.id = prs.user_id

          WHERE prs.token_hash = $1

          LIMIT 1

          FOR UPDATE OF prs, u
        `,
        [tokenHash]
      );

    return result.rows[0] ?? null;
  };


export const updateUserPassword =
  async (
    {
      userId,
      passwordHash,
    },
    client
  ) => {
    await client.query(
      `
        UPDATE public.users

        SET
          password_hash = $2,
          password_changed_at = NOW(),
          updated_at = NOW()

        WHERE id = $1
      `,
      [
        userId,
        passwordHash,
      ]
    );
  };


export const consumeResetSession =
  async (
    sessionId,
    client
  ) => {
    await client.query(
      `
        UPDATE public.password_reset_sessions

        SET consumed_at = NOW()

        WHERE id = $1
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [sessionId]
    );
  };


export const revokeOtherResetSessions =
  async (
    {
      userId,
      currentSessionId,
    },
    client
  ) => {
    await client.query(
      `
        UPDATE public.password_reset_sessions

        SET revoked_at = NOW()

        WHERE user_id = $1
          AND id <> $2
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      [
        userId,
        currentSessionId,
      ]
    );
  };