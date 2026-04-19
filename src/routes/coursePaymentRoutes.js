// src/routes/coursePaymentRoutes.js
import { Router } from "express";
import {
  createCourseOrder,
  verifyCoursePayment,
} from "../controllers/coursePaymentController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

// User clicks "Buy" → backend creates a Razorpay order
router.post("/create-order", verifyToken, createCourseOrder);

// Razorpay success callback on the frontend → backend verifies + enrolls + invoices
router.post("/verify", verifyToken, verifyCoursePayment);

export default router;