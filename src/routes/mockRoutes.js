import express from "express";
import {
  getMockQuestions,
  submitMockAttempt,
  getMockAttemptsByStudent,
} from "../controllers/mockController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Student gives mock test
router.get("/:course_id/questions", verifyToken, getMockQuestions);
router.post("/submit", verifyToken, submitMockAttempt);
router.get("/attempts/:student_id", verifyToken, getMockAttemptsByStudent);

export default router;
