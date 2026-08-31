export const lockCourseSlug = async (baseSlug, client) => {
  await client.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext($1)
      )
    `,
    [`course-slug:${baseSlug}`],
  );
};

export const findCourseSlugs = async (baseSlug, client) => {
  const result = await client.query(
    `
        SELECT slug

        FROM public.courses

        WHERE slug = $1
        OR slug LIKE $2
      `,
    [baseSlug, `${baseSlug}-%`],
  );

  return result.rows.map((row) => row.slug);
};

export const createCourse = async (
  {
    title,
    slug,

    shortDescription,
    thumbnailUrl,

    visibility,

    isFree,
    priceAmount,
    salePriceAmount,
    currency,

    accessType,
    accessDurationDays,
    accessEndAt,

    createdBy,
  },
  client,
) => {
  const result = await client.query(
    `
        INSERT INTO public.courses
        (
          title,
          slug,

          short_description,
          thumbnail_url,

          status,
          visibility,

          is_free,
          price_amount,
          sale_price_amount,
          currency,

          access_type,
          access_duration_days,
          access_end_at,

          created_by
        )

        VALUES
        (
          $1,
          $2,

          $3,
          $4,

          'draft',
          $5,

          $6,
          $7,
          $8,
          $9,

          $10,
          $11,
          $12,

          $13
        )

        RETURNING
          id,
          title,
          slug,

          short_description,
          thumbnail_url,

          status,
          visibility,

          is_free,
          price_amount,
          sale_price_amount,
          currency,

          access_type,
          access_duration_days,
          access_end_at,

          created_by,

          published_at,
          archived_at,

          created_at,
          updated_at
      `,
    [
      title,
      slug,

      shortDescription ?? null,
      thumbnailUrl ?? null,

      visibility,

      isFree,
      priceAmount,
      salePriceAmount ?? null,
      currency,

      accessType,
      accessDurationDays ?? null,

      accessEndAt ? new Date(accessEndAt) : null,

      createdBy,
    ],
  );

  return result.rows[0];
};

export const createCourseDetails = async (courseId, client) => {
  const result = await client.query(
    `
        INSERT INTO public.course_details
        (
          course_id
        )

        VALUES ($1)

        RETURNING
          id,
          course_id,
          subtitle,
          description,
          banner_url,
          category,
          level,
          language,
          what_you_will_learn,
          course_includes,
          course_highlights,
          estimated_duration_minutes,
          certificate_available,
          live_classes_available,
          whatsapp_contact,
          created_at,
          updated_at
      `,
    [courseId],
  );

  return result.rows[0];
};

export const findCourseById = async (courseId, db) => {
  const result = await db.query(
    `
          SELECT
            id,
            title,
            slug,
            status

          FROM public.courses

          WHERE id = $1

          LIMIT 1
        `,
    [courseId],
  );

  return result.rows[0] ?? null;
};

export const updateCourseDetails = async (courseId, input, client) => {
  /*
   * API field → DB column
   *
   * Whitelist prevents arbitrary
   * column names from entering SQL.
   */
  const fieldMap = {
    subtitle: "subtitle",

    description: "description",

    bannerUrl: "banner_url",

    category: "category",

    level: "level",

    language: "language",

    whatYouWillLearn: "what_you_will_learn",

    courseIncludes: "course_includes",

    courseHighlights: "course_highlights",

    estimatedDurationMinutes: "estimated_duration_minutes",

    certificateAvailable: "certificate_available",

    liveClassesAvailable: "live_classes_available",

    whatsappContact: "whatsapp_contact",
  };

  const updates = [];
  const values = [];

  let index = 1;

  for (const [apiField, dbColumn] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      updates.push(`${dbColumn} = $${index}`);

      values.push(input[apiField]);

      index++;
    }
  }

  if (updates.length === 0) {
    return null;
  }

  /*
   * course_id is the final parameter.
   */
  values.push(courseId);

  const result = await client.query(
    `
          UPDATE public.course_details

          SET
            ${updates.join(", ")},

            updated_at = NOW()

          WHERE course_id = $${index}

          RETURNING
            id,
            course_id,

            subtitle,
            description,
            banner_url,

            category,
            level,
            language,

            what_you_will_learn,
            course_includes,
            course_highlights,

            estimated_duration_minutes,

            certificate_available,
            live_classes_available,

            whatsapp_contact,

            created_at,
            updated_at
        `,
    values,
  );

  return result.rows[0] ?? null;
};

export const getCourseForUpdate = async (courseId, client) => {
  const result = await client.query(
    `
          SELECT
            id,
            title,
            slug,

            short_description,
            thumbnail_url,

            status,
            visibility,

            is_free,
            price_amount,
            sale_price_amount,
            currency,

            access_type,
            access_duration_days,
            access_end_at,

            created_by,

            published_at,
            archived_at,

            created_at,
            updated_at

          FROM public.courses

          WHERE id = $1

          FOR UPDATE
        `,
    [courseId],
  );

  return result.rows[0] ?? null;
};

export const updateCourse = async (courseId, input, client) => {
  const fieldMap = {
    title: "title",

    shortDescription: "short_description",

    thumbnailUrl: "thumbnail_url",

    visibility: "visibility",

    isFree: "is_free",

    priceAmount: "price_amount",

    salePriceAmount: "sale_price_amount",

    currency: "currency",

    accessType: "access_type",

    accessDurationDays: "access_duration_days",

    accessEndAt: "access_end_at",
  };

  const updates = [];
  const values = [];

  let parameterIndex = 1;

  for (const [apiField, dbColumn] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      updates.push(`${dbColumn} = $${parameterIndex}`);

      let value = input[apiField];

      if (apiField === "accessEndAt" && value != null) {
        value = new Date(value);
      }

      values.push(value);

      parameterIndex++;
    }
  }

  values.push(courseId);

  const result = await client.query(
    `
          UPDATE public.courses

          SET
            ${updates.join(", ")},

            updated_at = NOW()

          WHERE id =
            $${parameterIndex}

          RETURNING
            id,
            title,
            slug,

            short_description,
            thumbnail_url,

            status,
            visibility,

            is_free,
            price_amount,
            sale_price_amount,
            currency,

            access_type,
            access_duration_days,
            access_end_at,

            created_by,

            published_at,
            archived_at,

            created_at,
            updated_at
        `,
    values,
  );

  return result.rows[0] ?? null;
};
