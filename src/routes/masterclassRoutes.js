import express from "express";
import {
  createMasterclass,
  updateMasterclass,
  uploadMasterclassImage,
  getAllMasterclasses,
  getMasterclassById,
} from "../controllers/masterclassController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, uploadMasterclassImage, createMasterclass);
router.put("/:id", verifyToken, isAdmin, uploadMasterclassImage, updateMasterclass);

router.get("/all-masterclasses", getAllMasterclasses);
router.get("/:id", getMasterclassById);

export default router;