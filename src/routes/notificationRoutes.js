import express from "express";
import {
  getPublicNotifications,
  getAdminNotifications,
  createNotification,
  updateNotification,
  archiveNotification,
} from "../controllers/notificationController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Public route for homepage banner
router.get("/public", getPublicNotifications);

// Admin routes (protect with auth)
router.get("/admin", verifyToken, isAdmin, getAdminNotifications);
router.post("/admin", verifyToken, isAdmin, createNotification);
router.patch("/admin/:id", verifyToken, isAdmin, updateNotification);
router.delete("/admin/:id", verifyToken, isAdmin, archiveNotification);

export default router;
