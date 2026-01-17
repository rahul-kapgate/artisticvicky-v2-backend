import express from "express";
import {
  getMockQuestions,
  submitMockAttempt,
  getMockAttemptsByStudent,
  getMockAttemptDetails,
  createMockQuestion
} from "../controllers/mockController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import multer from "multer";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Student gives mock test
router.get("/:course_id/questions", verifyToken, getMockQuestions);
router.post("/submit", verifyToken, submitMockAttempt);
router.get("/attempts/:student_id", verifyToken, getMockAttemptsByStudent);

router.get("/attempt/:attempt_id/details", verifyToken, getMockAttemptDetails);

//Admin create mock test question 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

router.post("/:course_id/add-question", verifyToken, isAdmin, upload.single("image"), createMockQuestion);


export default router;
