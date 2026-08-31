export const findUserByGoogleIdForUpdate =
  async (
    googleId,
    client
  ) => {
    const result =
      await client.query(
        `
          SELECT
            id,
            name,
            email,
            mobile,
            profile_picture,
            google_id,
            auth_provider,
            password_hash,
            password_changed_at

          FROM public.users

          WHERE google_id = $1

          LIMIT 1

          FOR UPDATE
        `,
        [
          googleId,
        ]
      );

    return result.rows[0] ?? null;
  };


export const findUserByEmailForUpdate =
  async (
    email,
    client
  ) => {
    const result =
      await client.query(
        `
          SELECT
            id,
            name,
            email,
            mobile,
            profile_picture,
            google_id,
            auth_provider,
            password_hash,
            password_changed_at

          FROM public.users

          WHERE LOWER(email) = LOWER($1)

          LIMIT 1

          FOR UPDATE
        `,
        [
          email,
        ]
      );

    return result.rows[0] ?? null;
  };


export const linkGoogleAccount =
  async (
    {
      userId,
      googleId,
    },
    client
  ) => {
    const result =
      await client.query(
        `
          UPDATE public.users

          SET
            google_id = $2,

            auth_provider =
              CASE
                WHEN password_hash IS NOT NULL
                  THEN 'both'
                ELSE 'google'
              END,

            updated_at = NOW()

          WHERE id = $1

          RETURNING
            id,
            name,
            email,
            mobile,
            profile_picture,
            google_id,
            auth_provider,
            password_hash,
            password_changed_at
        `,
        [
          userId,
          googleId,
        ]
      );

    return result.rows[0];
  };


export const createGoogleUser =
  async (
    {
      name,
      email,
      googleId,
      profilePicture,
    },
    client
  ) => {
    const result =
      await client.query(
        `
          INSERT INTO public.users
          (
            name,
            email,
            google_id,
            profile_picture,
            auth_provider,
            password_hash
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            'google',
            NULL
          )

          RETURNING
            id,
            name,
            email,
            mobile,
            profile_picture,
            google_id,
            auth_provider,
            password_hash,
            password_changed_at
        `,
        [
          name,
          email,
          googleId,
          profilePicture ?? null,
        ]
      );

    return result.rows[0];
  };