import express from "express";
import {
  createMasterclass,
  updateMasterclass,
  uploadMasterclassFiles,
} from "../controllers/masterclassController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, uploadMasterclassFiles, createMasterclass);
router.put("/:id", verifyToken, isAdmin, uploadMasterclassFiles, updateMasterclass);

export default router;