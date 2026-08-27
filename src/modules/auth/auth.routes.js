import { Router } from "express";

import {
  register,
  verifyRegistrationOtp,
  resendRegistration,
} from "./auth.controller.js";

import {
  registerRateLimit,
  verifyOtpRateLimit,
  resendOtpRateLimit,
} from "../../middleware/authRateLimit.js";

const router = Router();

router.post("/register", registerRateLimit, register);

router.post("/register/verify", verifyOtpRateLimit, verifyRegistrationOtp);

router.post("/register/resend", resendOtpRateLimit, resendRegistration);

export default router;
