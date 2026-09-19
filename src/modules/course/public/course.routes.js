import { Router } from "express";

import { getPublicCourses, getPublicCourseBySlug } from "./course.controller.js";

const router = Router();

/**
 * Public course APIs
 *
 * Authentication is not required.
 */

router.get("/", getPublicCourses);

router.get("/:slug", getPublicCourseBySlug);

export default router;
