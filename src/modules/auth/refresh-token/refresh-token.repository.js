export const getSessionForRefresh =
  async (
    refreshTokenHash,
    client
  ) => {
    const result =
      await client.query(
        `
          SELECT
            s.session_id,
            s.user_id,
            s.platform,
            s.expires_at,
            s.revoked_at,
            s.created_at,

            u.password_changed_at

          FROM public.user_sessions s

          INNER JOIN public.users u
            ON u.id = s.user_id

          WHERE
            s.refresh_token_hash = $1

          LIMIT 1

          FOR UPDATE OF s
        `,
        [
          refreshTokenHash,
        ]
      );

    return result.rows[0] ??
      null;
  };

export const rotateRefreshToken =
  async (
    {
      sessionId,
      refreshTokenHash,
      ipAddress,
      userAgent,
    },
    client
  ) => {
    await client.query(
      `
        UPDATE public.user_sessions

        SET
          refresh_token_hash = $2,
          last_used_at = NOW(),
          ip_address = $3,
          user_agent = $4,
          updated_at = NOW()

        WHERE session_id = $1
          AND revoked_at IS NULL
      `,
      [
        sessionId,
        refreshTokenHash,
        ipAddress ?? null,
        userAgent ?? null,
      ]
    );
  };

export const revokeRefreshSession =
  async (
    {
      sessionId,
      reason,
    },
    client
  ) => {
    await client.query(
      `
        UPDATE public.user_sessions

        SET
          revoked_at = NOW(),
          revoked_reason = $2,
          updated_at = NOW()

        WHERE session_id = $1
          AND revoked_at IS NULL
      `,
      [
        sessionId,
        reason,
      ]
    );
  };