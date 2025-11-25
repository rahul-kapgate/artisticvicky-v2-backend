import { Router } from "express";
import { sendInvoiceController } from "../controllers/adminBillingController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = Router();

// POST /admin/billing/send-invoice
router.post("/billing/send-invoice",verifyToken, isAdmin, sendInvoiceController);

export default router;
