import express from "express";
import {
  createSection,
  getSectionsWithVideos,
  updateSection,
  deleteSection,
} from "../controllers/sectionController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, createSection);
router.get("/", verifyToken, getSectionsWithVideos);
router.put("/:id", verifyToken, isAdmin, updateSection);     // ✏️ New edit route
router.delete("/:id", verifyToken, isAdmin, deleteSection);

export default router;
