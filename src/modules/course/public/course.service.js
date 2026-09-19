import {
  findPublicCourses,
  findPublicCourseBySlug,
} from "./course.repository.js";

import { AppError } from "../../../utils/AppError.js";

export const getPublicCourses = async () => {
  const courses = await findPublicCourses();

  return courses.map((course) => ({
    id: course.id,

    title: course.title,

    slug: course.slug,

    shortDescription: course.short_description,

    thumbnailPath: course.thumbnail_path,

    estimatedDurationMinutes: course.estimated_duration_minutes,

    pricing: {
      isFree: course.is_free,

      priceAmount: Number(course.price_amount),

      salePriceAmount:
        course.sale_price_amount !== null
          ? Number(course.sale_price_amount)
          : null,

      currency: course.currency,
    },

    courseIncludes: Array.isArray(course.course_includes)
      ? course.course_includes
      : [],
  }));
};

export const getPublicCourseBySlug = async (slug) => {
  const course = await findPublicCourseBySlug(slug);

  if (!course) {
    throw new AppError("Course not found", 404, "COURSE_NOT_FOUND");
  }

  return {
    id: course.id,

    title: course.title,

    slug: course.slug,

    subtitle: course.subtitle,

    shortDescription: course.short_description,

    description: course.description,

    media: {
      thumbnailPath: course.thumbnail_path,

      bannerPath: course.banner_path,
    },

    category: course.category,

    level: course.level,

    language: course.language,

    estimatedDurationMinutes: course.estimated_duration_minutes,

    pricing: {
      isFree: course.is_free,

      priceAmount: Number(course.price_amount),

      salePriceAmount:
        course.sale_price_amount !== null
          ? Number(course.sale_price_amount)
          : null,

      currency: course.currency,
    },

    access: {
      type: course.access_type,

      durationDays: course.access_duration_days,

      endAt: course.access_end_at,
    },

    whatYouWillLearn: Array.isArray(course.what_you_will_learn)
      ? course.what_you_will_learn
      : [],

    courseIncludes: Array.isArray(course.course_includes)
      ? course.course_includes
      : [],

    courseHighlights: Array.isArray(course.course_highlights)
      ? course.course_highlights
      : [],

    certificateAvailable: course.certificate_available,

    liveClassesAvailable: course.live_classes_available,

    whatsappContact: course.whatsapp_contact,

    publishedAt: course.published_at,
  };
};
