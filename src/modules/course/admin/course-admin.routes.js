import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate.js";

import { requireRole } from "../../../middlewares/requireRole.js";

import {
  createCourse,
  updateCourseDetails,
} from "./course-admin.controller.js";

const router = Router();

router.use(authenticate);

router.use(requireRole("admin"));

router.post("/", createCourse);

router.patch("/:id/details", updateCourseDetails);

export default router;
