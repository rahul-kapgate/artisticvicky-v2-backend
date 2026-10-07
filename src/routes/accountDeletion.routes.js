import express from "express";

import {
  requestDeleteAccountOtp,
  verifyDeleteAccountOtp,
  runAccountDeletionCron,
} from "../controllers/accountDeletion.controller.js";

import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/delete/request-otp", verifyToken, requestDeleteAccountOtp);

router.post("/delete/verify-otp", verifyToken, verifyDeleteAccountOtp);

router.post("/process", runAccountDeletionCron);

export default router;
