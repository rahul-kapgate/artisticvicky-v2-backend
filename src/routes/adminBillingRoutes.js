import { Router } from "express";
import {
    sendInvoiceController,
    listInvoicesController,
} from "../controllers/adminBillingController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = Router();

// POST /admin/billing/send-invoice
router.post("/billing/send-invoice", verifyToken, isAdmin, sendInvoiceController);

// ✅ GET - list user-course pairs with invoice status
router.get("/billing/invoices",verifyToken, isAdmin, listInvoicesController);



export default router;
