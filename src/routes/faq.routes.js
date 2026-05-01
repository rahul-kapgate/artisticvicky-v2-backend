import express from "express";
import {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  toggleFaqStatus,
} from "../controllers/faq/faqController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Public
router.get("/", getAllFaqs);

router.post("/", verifyToken, isAdmin, createFaq);
router.put("/:id", verifyToken, isAdmin, updateFaq);
router.delete("/:id", verifyToken, isAdmin, deleteFaq);
router.patch("/:id/toggle", verifyToken, isAdmin, toggleFaqStatus);

export default router;
