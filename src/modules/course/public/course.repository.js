import { pool } from "../../../config/database.js";

/**
 * Landing page courses
 *
 * Returns only published + public courses.
 * Only fields required by course cards are selected.
 */
export const findPublicCourses = async () => {
  const query = `
    SELECT
      c.id,
      c.title,
      c.slug,
      c.short_description,
      c.thumbnail_path,

      c.is_free,
      c.price_amount,
      c.sale_price_amount,
      TRIM(c.currency) AS currency,

      cd.estimated_duration_minutes,
      cd.course_includes

    FROM courses c

    INNER JOIN course_details cd
      ON cd.course_id = c.id

    WHERE
      c.status = 'published'
      AND c.visibility = 'public'

    ORDER BY
      c.published_at DESC,
      c.created_at DESC
  `;

  const result = await pool.query(query);

  return result.rows;
};

/**
 * Single public course
 *
 * Returns complete information required by the
 * public course details page.
 */
export const findPublicCourseBySlug = async (slug) => {
  const query = `
    SELECT
      c.id,
      c.title,
      c.slug,
      c.short_description,
      c.thumbnail_path,

      c.is_free,
      c.price_amount,
      c.sale_price_amount,
      TRIM(c.currency) AS currency,

      c.access_type,
      c.access_duration_days,
      c.access_end_at,

      c.published_at,

      cd.subtitle,
      cd.description,
      cd.banner_path,

      cd.category,
      cd.level,
      cd.language,

      cd.what_you_will_learn,
      cd.course_includes,
      cd.course_highlights,

      cd.estimated_duration_minutes,

      cd.certificate_available,
      cd.live_classes_available,

      cd.whatsapp_contact

    FROM courses c

    INNER JOIN course_details cd
      ON cd.course_id = c.id

    WHERE
      c.slug = $1
      AND c.status = 'published'
      AND c.visibility = 'public'

    LIMIT 1
  `;

  const result = await pool.query(query, [slug]);

  return result.rows[0] ?? null;
};
