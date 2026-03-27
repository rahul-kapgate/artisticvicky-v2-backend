import express from "express";
import { getUsersWithCourses, enrollUserInCourse, unenrollUserFromCourse, getDashboardStats, getAllUsers } from "../controllers/adminController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";
import { getMockTestScore, getPyqTestData, getMockTestSummary } from "../controllers/adminMockTestReport.js";
import {
  getAdminCourseReviews,
  getPendingCourseReviews,
  approveCourseReview,
  rejectCourseReview,
} from "../controllers/courseReviewController.js";

const router = express.Router();

router.get("/users-with-courses", verifyToken, isAdmin, getUsersWithCourses);
router.post("/enroll", verifyToken, isAdmin, enrollUserInCourse);
router.post("/unenroll", verifyToken, isAdmin, unenrollUserFromCourse);

router.get("/dashboard-stats", verifyToken, isAdmin, getDashboardStats);

router.get("/all-users", verifyToken, isAdmin, getAllUsers);

router.post("/mock-test-score", verifyToken, isAdmin, getMockTestScore)

router.post("/pyq-test-score", verifyToken, isAdmin, getPyqTestData)

router.post("/mock-test-summary", verifyToken, isAdmin, getMockTestSummary);

router.get("/course-reviews", verifyToken, isAdmin, getAdminCourseReviews);
router.get("/course-reviews/pending", verifyToken, isAdmin, getPendingCourseReviews);
router.patch("/course-reviews/:id/approve", verifyToken, isAdmin, approveCourseReview);
router.patch("/course-reviews/:id/reject", verifyToken, isAdmin, rejectCourseReview);

export default router;
