import express from "express";
import {
  createCourseReview,
  getCourseReviewsByCourse,
  updateCourseReview,
  deleteCourseReview,
  getMyCourseReviewStatus
} from "../controllers/courseReviewController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, createCourseReview);
router.get("/course/:courseId", getCourseReviewsByCourse);
router.put("/:id", verifyToken, updateCourseReview);
router.delete("/:id", verifyToken, deleteCourseReview);

router.get("/me/course/:courseId", verifyToken, getMyCourseReviewStatus);


export default router;