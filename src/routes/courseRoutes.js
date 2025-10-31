import express from "express";
import { createCourse } from "../controllers/courseController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// only admin can create a course
router.post("/add-course", verifyToken, isAdmin, createCourse);

export default router;