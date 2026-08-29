import {
  Router,
} from "express";


import {
  requestReset,
  verifyResetOtp,
  updatePassword,
} from "./forgot-password.controller.js";


import {
  forgotPasswordRequestRateLimit,
  forgotPasswordVerifyRateLimit,
  forgotPasswordResetRateLimit,
} from "../../../middlewares/authRateLimit.js";


const router =
  Router();


router.post(
  "/request",

  forgotPasswordRequestRateLimit,

  requestReset
);


router.post(
  "/verify",

  forgotPasswordVerifyRateLimit,

  verifyResetOtp
);


router.post(
  "/reset",

  forgotPasswordResetRateLimit,

  updatePassword
);


export default router;