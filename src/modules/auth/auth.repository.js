import { pool } from "../../config/database.js";

export const lockEmail = async (client, email) => {
  await client.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext($1)
      )
    `,
    [email],
  );
};

export const findUserByEmail = async (email, db = pool) => {
  const result = await db.query(
    `
      SELECT id, email
      FROM public.users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] ?? null;
};

export const findUserByMobile = async (mobile, db = pool) => {
  if (!mobile) {
    return null;
  }

  const result = await db.query(
    `
      SELECT id, mobile
      FROM public.users
      WHERE mobile = $1
      LIMIT 1
    `,
    [mobile],
  );

  return result.rows[0] ?? null;
};

export const findPendingUserByEmailForUpdate = async (email, client) => {
  const result = await client.query(
    `
        SELECT
          id,
          name,
          email,
          mobile,
          password_hash,
          expires_at,
          created_at
        FROM public.pending_users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        FOR UPDATE
      `,
    [email],
  );

  return result.rows[0] ?? null;
};

export const findPendingUserByIdForUpdate = async (pendingUserId, client) => {
  const result = await client.query(
    `
        SELECT
          id,
          name,
          email,
          mobile,
          password_hash,
          expires_at,
          created_at
        FROM public.pending_users
        WHERE id = $1
        FOR UPDATE
      `,
    [pendingUserId],
  );

  return result.rows[0] ?? null;
};

export const createPendingUser = async (
  { name, email, mobile, passwordHash, expiresAt },
  client,
) => {
  const result = await client.query(
    `
      INSERT INTO public.pending_users (
        name,
        email,
        mobile,
        password_hash,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        name,
        email,
        mobile,
        expires_at
    `,
    [name, email, mobile, passwordHash, expiresAt],
  );

  return result.rows[0];
};

export const updatePendingUser = async (
  pendingUserId,
  { name, email, mobile, passwordHash, expiresAt },
  client,
) => {
  const result = await client.query(
    `
      UPDATE public.pending_users
      SET
        name = $2,
        email = $3,
        mobile = $4,
        password_hash = $5,
        expires_at = $6
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        mobile,
        expires_at
    `,
    [pendingUserId, name, email, mobile, passwordHash, expiresAt],
  );

  return result.rows[0];
};

export const findLatestRegistrationOtp = async (pendingUserId, client) => {
  const result = await client.query(
    `
        SELECT
          otp_id,
          created_at,
          expires_at,
          attempts
        FROM public.otp_verifications
        WHERE pending_user_id = $1
          AND purpose = 'registration'
          AND verified_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
    [pendingUserId],
  );

  return result.rows[0] ?? null;
};

export const deletePendingRegistrationOtps = async (pendingUserId, client) => {
  await client.query(
    `
        DELETE FROM public.otp_verifications
        WHERE pending_user_id = $1
          AND purpose = 'registration'
          AND verified_at IS NULL
      `,
    [pendingUserId],
  );
};

export const createRegistrationOtp = async (
  { pendingUserId, otpHash, expiresAt },
  client,
) => {
  const result = await client.query(
    `
      INSERT INTO public.otp_verifications (
        pending_user_id,
        purpose,
        otp_hash,
        expires_at
      )
      VALUES (
        $1,
        'registration',
        $2,
        $3
      )
      RETURNING
        otp_id,
        pending_user_id,
        expires_at,
        created_at
    `,
    [pendingUserId, otpHash, expiresAt],
  );

  return result.rows[0];
};

export const deleteOtpById = async (otpId, db = pool) => {
  await db.query(
    `
      DELETE FROM public.otp_verifications
      WHERE otp_id = $1
        AND verified_at IS NULL
    `,
    [otpId],
  );
};

export const getRegistrationVerificationForUpdate = async (
  verificationId,
  client,
) => {
  const result = await client.query(
    `
        SELECT
          o.otp_id,
          o.pending_user_id,
          o.otp_hash,
          o.expires_at AS otp_expires_at,
          o.attempts,
          o.verified_at,

          p.name,
          p.email,
          p.mobile,
          p.password_hash,
          p.expires_at AS pending_expires_at

        FROM public.otp_verifications o

        INNER JOIN public.pending_users p
          ON p.id = o.pending_user_id

        WHERE o.otp_id = $1
          AND o.purpose = 'registration'

        LIMIT 1

        FOR UPDATE OF o, p
      `,
    [verificationId],
  );

  return result.rows[0] ?? null;
};

export const incrementOtpAttempts = async (otpId, client) => {
  const result = await client.query(
    `
      UPDATE public.otp_verifications
      SET attempts = attempts + 1
      WHERE otp_id = $1
      RETURNING attempts
    `,
    [otpId],
  );

  return result.rows[0];
};

export const createUser = async (
  { name, email, mobile, passwordHash },
  client,
) => {
  const result = await client.query(
    `
      INSERT INTO public.users (
        name,
        email,
        mobile,
        password_hash,
        auth_provider
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'email'
      )
      RETURNING
        id,
        name,
        email,
        mobile,
        profile_picture,
        auth_provider,
        created_at
    `,
    [name, email, mobile, passwordHash],
  );

  return result.rows[0];
};

export const transferOtpToUser = async ({ otpId, userId }, client) => {
  await client.query(
    `
      UPDATE public.otp_verifications
      SET
        pending_user_id = NULL,
        user_id = $2,
        verified_at = NOW()
      WHERE otp_id = $1
    `,
    [otpId, userId],
  );
};

export const deletePendingUser = async (pendingUserId, client) => {
  await client.query(
    `
      DELETE FROM public.pending_users
      WHERE id = $1
    `,
    [pendingUserId],
  );
};
