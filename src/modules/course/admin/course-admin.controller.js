import {
  parseCreateCourseInput,
  parseUpdateCourseDetailsInput,
  parseUpdateCourseInput,
  parseAdminCourseListQuery,
} from "./course-admin.validation.js";

import {
  createAdminCourse,
  updateAdminCourseDetails,
  updateAdminCourse,
  publishAdminCourse,
  archiveAdminCourse,
  getAdminCourses,
  getAdminCourse,
} from "./course-admin.service.js";

export const createCourse = async (req, res) => {
  const input = parseCreateCourseInput(req.body);

  const result = await createAdminCourse({
    input,

    adminUserId: req.user.id,
  });

  return res.status(201).json({
    success: true,

    message: "Course created successfully.",

    data: {
      course: result.course,

      details: result.details,
    },
  });
};

export const updateCourseDetails = async (req, res) => {
  const courseId = parseCourseId(req.params.id);

  const input = parseUpdateCourseDetailsInput(req.body);

  const details = await updateAdminCourseDetails({
    courseId,
    input,
  });

  return res.status(200).json({
    success: true,

    message: "Course details updated successfully.",

    data: {
      details,
    },
  });
};

export const updateCourse = async (req, res) => {
  const courseId = parseCourseId(req.params.id);

  const input = parseUpdateCourseInput(req.body);

  const course = await updateAdminCourse({
    courseId,
    input,
  });

  return res.status(200).json({
    success: true,

    message: "Course updated successfully.",

    data: {
      course,
    },
  });
};

export const publishCourse = async (req, res) => {
  const courseId = parseCourseId(req.params.id);

  const course = await publishAdminCourse({
    courseId,
  });

  return res.status(200).json({
    success: true,

    message: "Course published successfully.",

    data: {
      course,
    },
  });
};

export const archiveCourse = async (req, res) => {
  const courseId = parseCourseId(req.params.id);

  const course = await archiveAdminCourse({
    courseId,
  });

  return res.status(200).json({
    success: true,

    message: "Course archived successfully.",

    data: {
      course,
    },
  });
};

export const listCourses = async (req, res) => {
  const query = parseAdminCourseListQuery(req.query);

  const result = await getAdminCourses(query);

  return res.status(200).json({
    success: true,

    data: result,
  });
};

export const getCourse = async (req, res) => {
  const courseId = parseCourseId(req.params.id);

  const course = await getAdminCourse({
    courseId,
  });

  return res.status(200).json({
    success: true,

    data: {
      course,
    },
  });
};
