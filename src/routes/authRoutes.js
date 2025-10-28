import express from "express";
import { login, signupInitiate, signupVerify } from "../controllers/authController.js";
import { forgotPasswordInitiate, forgotPasswordVerify } from "../controllers/forgotPasswordController.js";
// import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Public Routes
router.post("/login", login);

router.post("/signup/initiate", signupInitiate);
router.post("/signup/verify", signupVerify );

router.post("/forgot-password/initiate", forgotPasswordInitiate);
router.post("/forgot-password/verify", forgotPasswordVerify);

// router.post("/refresh-token", refreshToken);



// ✅ Protected Route Example (only for logged-in users)
// router.post("/logout", verifyToken, logout);

export default router;
