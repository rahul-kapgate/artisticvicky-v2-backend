import express from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";
import {
  createLiveTest,
  publishLiveTest,
  unpublishLiveTest,
  getPublicLiveTests,
  getLiveTestById,
  submitLiveTest,
  getAllLiveTestsAdmin,
  getLiveTestResults,
  exportLiveTestResultsExcel,
} from "../controllers/liveTestController.js";

const router = express.Router();

// public / student
router.get("/public", getPublicLiveTests);
router.get("/:id", verifyToken, getLiveTestById);
router.post("/:id/submit", verifyToken, submitLiveTest);

// admin
router.post("/admin/create", verifyToken, isAdmin, createLiveTest);
router.patch("/admin/:id/publish", verifyToken, isAdmin, publishLiveTest);
router.patch("/admin/:id/unpublish", verifyToken, isAdmin, unpublishLiveTest);
router.get("/admin/all", verifyToken, isAdmin, getAllLiveTestsAdmin);
router.get("/admin/:id/results", verifyToken, isAdmin, getLiveTestResults);
router.get(
  "/admin/:id/results/export",
  verifyToken,
  isAdmin,
  exportLiveTestResultsExcel
);

export default router;