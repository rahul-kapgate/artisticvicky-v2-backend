import {
  pool,
} from "../../../config/database.js";

export const revokeCurrentSession =
  async ({
    userId,
    sessionId,
  }) => {
    await pool.query(
      `
        UPDATE public.user_sessions

        SET
          revoked_at = NOW(),
          revoked_reason = 'logout',
          updated_at = NOW()

        WHERE user_id = $1
          AND session_id = $2
          AND revoked_at IS NULL
      `,
      [
        userId,
        sessionId,
      ]
    );
  };

export const revokeAllSessions =
  async (
    userId
  ) => {
    await pool.query(
      `
        UPDATE public.user_sessions

        SET
          revoked_at = NOW(),
          revoked_reason = 'logout_all',
          updated_at = NOW()

        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [
        userId,
      ]
    );
  };