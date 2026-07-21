import express from "express";
import { login, signupInitiate, signupVerify, refreshToken, googleLogin  } from "../controllers/authController.js";
import { forgotPasswordInitiate, forgotPasswordVerify } from "../controllers/forgotPasswordController.js";

const router = express.Router();

// ✅ Public Routes
router.post("/login", login);

router.post("/signup/initiate", signupInitiate);
router.post("/signup/verify", signupVerify );

router.post("/forgot-password/initiate", forgotPasswordInitiate);
router.post("/forgot-password/verify", forgotPasswordVerify);

router.post("/refresh-token", refreshToken);

router.post("/google", googleLogin);


export default router;
