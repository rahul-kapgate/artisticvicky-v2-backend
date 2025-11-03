import express from "express";
import { getUsersWithCourses, enrollUserInCourse, unenrollUserFromCourse, getDashboardStats, getAllUsers } from "../controllers/adminController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get("/users-with-courses", verifyToken, isAdmin, getUsersWithCourses);
router.post("/enroll", verifyToken, isAdmin, enrollUserInCourse);
router.post("/unenroll", verifyToken, isAdmin, unenrollUserFromCourse);

router.get("/dashboard-stats", verifyToken, isAdmin, getDashboardStats);

router.get("/all-users", verifyToken, isAdmin, getAllUsers);

export default router;
