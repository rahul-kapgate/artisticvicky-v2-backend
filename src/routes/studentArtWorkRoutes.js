// routes/studentArtWorkRoutes.js
import express from "express";
import {
  uploadArt,
  createStudentArtWork,
  getAllStudentArtWork,
  getStudentArtWorkById,
  updateStudentArtWork,
  deleteStudentArtWork,
} from "../controllers/studentArtWorkController.js";

import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// ADMIN — ADD ARTWORK
router.post(
  "/add",
  verifyToken,
  isAdmin,
  uploadArt.single("file"),
  createStudentArtWork
);

// ADMIN — UPDATE
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  uploadArt.single("file"),
  updateStudentArtWork
);

// ADMIN — DELETE
router.delete("/:id", verifyToken, isAdmin, deleteStudentArtWork);

// PUBLIC — GET
router.get("/all", getAllStudentArtWork);
router.get("/:id", getStudentArtWorkById);

export default router;
