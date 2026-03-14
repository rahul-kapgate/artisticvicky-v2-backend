import express from "express";
import {
  upload,
  createMasterclass,
  getAllMasterclasses,
  getMasterclassById,
  updateMasterclass,
  deleteMasterclass,
} from "../controllers/masterclassController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// only admin can create/update/delete masterclass
router.post(
  "/add-masterclass",
  verifyToken,
  isAdmin,
  upload.single("file"),
  createMasterclass
);

router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.single("file"),
  updateMasterclass
);

router.delete("/:id", verifyToken, isAdmin, deleteMasterclass);

// public routes
router.get("/all-masterclasses", getAllMasterclasses);
router.get("/:id", getMasterclassById);

export default router;