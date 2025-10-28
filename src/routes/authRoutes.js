import express from "express";
import { login } from "../controllers/authController.js";
// import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Public Routes
// router.post("/register", register);
router.post("/login", login);
// router.post("/refresh-token", refreshToken);

// ✅ Protected Route Example (only for logged-in users)
// router.post("/logout", verifyToken, logout);

export default router;
