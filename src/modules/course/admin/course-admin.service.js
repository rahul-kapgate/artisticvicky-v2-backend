import { pool } from "../../../config/database.js";

import { generateCourseSlug } from "../shared/courseSlug.js";

import {
  lockCourseSlug,
  findCourseSlugs,
  createCourse,
  createCourseDetails,
  findCourseById,
  updateCourseDetails,
} from "./course-admin.repository.js";

import AppError from "../../../utils/AppError.js";

const resolveUniqueSlug = (baseSlug, existingSlugs) => {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix++;
  }

  return `${baseSlug}-${suffix}`;
};

export const createAdminCourse = async ({ input, adminUserId }) => {
  const baseSlug = generateCourseSlug(input.title);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Prevent concurrent course creates
     * from generating the same slug.
     */
    await lockCourseSlug(baseSlug, client);

    const existingSlugs = await findCourseSlugs(baseSlug, client);

    const slug = resolveUniqueSlug(baseSlug, existingSlugs);

    const course = await createCourse(
      {
        ...input,

        slug,

        createdBy: adminUserId,
      },

      client,
    );

    const details = await createCourseDetails(course.id, client);

    await client.query("COMMIT");

    return {
      course,
      details,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }

    throw error;
  } finally {
    client.release();
  }
};

export const updateAdminCourseDetails = async ({ courseId, input }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Lock the course while its
     * details are being updated.
     */
    const result = await client.query(
      `
            SELECT
              id,
              status

            FROM public.courses

            WHERE id = $1

            FOR UPDATE
          `,
      [courseId],
    );

    const course = result.rows[0];

    if (!course) {
      throw new AppError("Course not found.", 404, {
        code: "COURSE_NOT_FOUND",
      });
    }

    const details = await updateCourseDetails(courseId, input, client);

    /*
     * Normally this should always
     * exist because create-course
     * creates course_details too.
     *
     * Treat missing data as an
     * integrity problem.
     */
    if (!details) {
      throw new AppError("Course details not found.", 404, {
        code: "COURSE_DETAILS_NOT_FOUND",
      });
    }

    await client.query("COMMIT");

    return details;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }

    throw error;
  } finally {
    client.release();
  }
};
