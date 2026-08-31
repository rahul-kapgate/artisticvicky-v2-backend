import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate.js";

import { requireRole } from "../../../middlewares/requireRole.js";

import {
  createCourse,
  updateCourse,
  updateCourseDetails,
  publishCourse,
  archiveCourse,
  listCourses,
  getCourse,
} from "./course-admin.controller.js";

const router = Router();

router.use(authenticate);

router.use(requireRole("admin"));

router.post("/", createCourse);

router.patch("/:id", updateCourse);

router.patch("/:id/details", updateCourseDetails);

router.post("/:id/publish", publishCourse);

router.post("/:id/archive", archiveCourse);

router.get("/", listCourses);

router.get("/:id", getCourse);

export default router;
