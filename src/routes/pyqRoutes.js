import express from "express";
import multer from "multer";
import {
  getPYQPapers,
  getPYQQuestions,
  submitPYQAttempt,
  getPYQAttemptsByStudent,
  getPYQAttemptDetails,
  getPYQQuestionsWithImages,
  updatePYQQuestionImage,
} from "../controllers/pyqController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      file.mimetype,
    );

    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

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

// Admin routes
router.get(
  "/paper/:paper_id/questions-with-images",
  verifyToken,
  isAdmin,
  getPYQQuestionsWithImages,
);

router.put(
  "/questions/:question_id/image",
  verifyToken,
  isAdmin,
  upload.single("image"),
  updatePYQQuestionImage,
);

export default router;
