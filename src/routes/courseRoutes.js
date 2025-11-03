import express from "express";
import {
  upload,
  createCourse,
  getAllCourses,
  getCourseById,
  getEnrolledCourses,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// only admin can create a course
router.post(
  "/add-course",
  verifyToken,
  isAdmin,
  upload.single("file"),
  createCourse
);

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.single("file"),
  updateCourse
);

router.delete("/:id", verifyToken, isAdmin, deleteCourse);

router.get("/all-courses", getAllCourses);
router.get("/:id", getCourseById);

router.get("/enrolled/:userId", verifyToken, getEnrolledCourses);

export default router;