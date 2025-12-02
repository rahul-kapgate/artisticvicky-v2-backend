// src/routes/coursePaymentRoutes.js
import { Router } from "express";
import {
  createCourseOrder,
  verifyCoursePayment,
} from "../controllers/coursePaymentController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

// user clicks "buy" → create order
router.post("/create-order", verifyToken, createCourseOrder);

// Razorpay success handler → verify & auto-enroll
router.post("/verify", verifyToken, verifyCoursePayment);

export default router;
