import express from "express";
import {
  getUserProfile,
  updateUserProfile
} from "../controllers/userController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Protected routes
router.get("/profile", verifyToken, getUserProfile);
router.patch("/profile", verifyToken, updateUserProfile);


export default router;
