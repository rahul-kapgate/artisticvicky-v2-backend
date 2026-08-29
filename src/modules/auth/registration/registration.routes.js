import { Router } from "express";

import {
  register,
  verifyRegistrationOtp,
  resendRegistration,
} from "./registration.controller.js";

import {
  registerRateLimit,
  verifyOtpRateLimit,
  resendOtpRateLimit,
} from "../../../middlewares/authRateLimit.js";

const router = Router();

router.post("/", registerRateLimit, register);

router.post("/verify", verifyOtpRateLimit, verifyRegistrationOtp);

router.post("/resend", resendOtpRateLimit, resendRegistration);

export default router;
