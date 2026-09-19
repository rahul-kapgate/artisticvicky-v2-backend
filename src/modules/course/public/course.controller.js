import { getCourses, getCourseBySlug } from "./course.service.js";

/**
 * GET /api/v1/courses
 */
export const getPublicCourses = async (req, res) => {
  const courses = await getCourses();

  return res.status(200).json({
    success: true,
    data: courses,
  });
};

/**
 * GET /api/v1/courses/:slug
 */
export const getPublicCourseBySlug = async (req, res) => {
  const { slug } = req.params;

  const course = await getCourseBySlug(slug);

  return res.status(200).json({
    success: true,
    data: course,
  });
};
