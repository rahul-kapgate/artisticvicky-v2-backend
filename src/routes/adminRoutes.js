import express from "express";
import {
  getUsersWithCourses,
  enrollUserInCourse,
  getDashboardStats,
  getAllUsers,
  getBlockedUsers,
  blockUserFromCourse,
  unblockUserFromCourse,
} from "../controllers/admin/adminController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";
import {
  getMockTestScore,
  getPyqTestData,
  getMockTestSummary,
} from "../controllers/admin/adminMockTestReport.js";
import {
  getAdminCourseReviews,
  getPendingCourseReviews,
  approveCourseReview,
  rejectCourseReview,
  toggleCourseReviewHomeVisibility,
} from "../controllers/courseReviewController.js";

const router = express.Router();

router.get("/users-with-courses", verifyToken, isAdmin, getUsersWithCourses);
router.post("/enroll", verifyToken, isAdmin, enrollUserInCourse);

router.get("/dashboard-stats", verifyToken, isAdmin, getDashboardStats);

router.get("/all-users", verifyToken, isAdmin, getAllUsers);

router.post("/mock-test-score", verifyToken, isAdmin, getMockTestScore);

router.post("/pyq-test-score", verifyToken, isAdmin, getPyqTestData);

router.post("/mock-test-summary", verifyToken, isAdmin, getMockTestSummary);

router.get("/course-reviews", verifyToken, isAdmin, getAdminCourseReviews);
router.get(
  "/course-reviews/pending",
  verifyToken,
  isAdmin,
  getPendingCourseReviews,
);
router.patch(
  "/course-reviews/:id/approve",
  verifyToken,
  isAdmin,
  approveCourseReview,
);
router.patch(
  "/course-reviews/:id/reject",
  verifyToken,
  isAdmin,
  rejectCourseReview,
);
router.patch(
  "/course-reviews/:id/home-visibility",
  verifyToken,
  isAdmin,
  toggleCourseReviewHomeVisibility,
);

router.post(
  "/courses/:courseId/users/:userId/block",
  verifyToken,
  requireAdmin,
  blockUserFromCourse,
);

router.post(
  "/courses/:courseId/users/:userId/unblock",
  verifyToken,
  requireAdmin,
  unblockUserFromCourse,
);

router.get(
  "/courses/:courseId/blocked-users",
  verifyToken,
  requireAdmin,
  getBlockedUsers,
);

export default router;
