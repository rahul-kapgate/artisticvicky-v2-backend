import express from "express";
import {
  createMasterclass,
  updateMasterclass,
  uploadMasterclassImage,
} from "../controllers/masterclassController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, uploadMasterclassImage, createMasterclass);
router.put("/:id", verifyToken, isAdmin, uploadMasterclassImage, updateMasterclass);

export default router;