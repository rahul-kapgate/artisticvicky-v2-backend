import { pool } from "../../../config/database.js";

import { generateCourseSlug } from "../shared/courseSlug.js";

import {
  lockCourseSlug,
  findCourseSlugs,
  createCourse,
  createCourseDetails,
  findCourseById,
  updateCourseDetails,
  getCourseForUpdate,
  updateCourse,
} from "./course-admin.repository.js";

import AppError from "../../../utils/AppError.js";

import { validateResolvedCourseInput } from "./course-admin.validation.js";

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

export const updateAdminCourse = async ({ courseId, input }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentCourse = await getCourseForUpdate(courseId, client);

    if (!currentCourse) {
      throw new AppError("Course not found.", 404, {
        code: "COURSE_NOT_FOUND",
      });
    }

    /*
     * Build the final course state.
     *
     * This is important for PATCH.
     */
    const resolved = {
      isFree: input.isFree ?? currentCourse.is_free,

      priceAmount: input.priceAmount ?? Number(currentCourse.price_amount),

      salePriceAmount: Object.prototype.hasOwnProperty.call(
        input,
        "salePriceAmount",
      )
        ? input.salePriceAmount
        : currentCourse.sale_price_amount == null
          ? null
          : Number(currentCourse.sale_price_amount),

      accessType: input.accessType ?? currentCourse.access_type,

      accessDurationDays: Object.prototype.hasOwnProperty.call(
        input,
        "accessDurationDays",
      )
        ? input.accessDurationDays
        : currentCourse.access_duration_days,

      accessEndAt: Object.prototype.hasOwnProperty.call(input, "accessEndAt")
        ? input.accessEndAt
        : currentCourse.access_end_at,
    };

    validateResolvedCourseInput(resolved);

    const updatedCourse = await updateCourse(courseId, input, client);

    await client.query("COMMIT");

    return updatedCourse;
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
