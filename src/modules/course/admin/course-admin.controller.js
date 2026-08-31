import {
  parseCreateCourseInput,
  parseCourseId,
  parseUpdateCourseDetailsInput,
} from "./course-admin.validation.js";

import {
  createAdminCourse,
  updateAdminCourseDetails,
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
