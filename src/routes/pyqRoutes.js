import express from "express";
import {
  getPYQPapers,
  getPYQQuestions,
  submitPYQAttempt,
  getPYQAttemptsByStudent,
  getPYQAttemptDetails,
} from "../controllers/pyqController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get all PYQ papers for a course
router.get("/:course_id/papers", verifyToken, getPYQPapers);

// Get all questions for a specific paper
router.get("/paper/:paper_id/questions", verifyToken, getPYQQuestions);

// Submit a PYQ attempt
router.post("/attempt/submit", verifyToken, submitPYQAttempt);

// Get all attempts by a student
router.get("/attempts/:student_id", verifyToken, getPYQAttemptsByStudent);

// Get detailed attempt data
router.get("/attempt/:attempt_id/details", verifyToken, getPYQAttemptDetails);

export default router;
