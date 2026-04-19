import { Router } from "express";
import {
    listInvoicesController,
} from "../controllers/admin/adminBillingController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = Router();

// ✅ GET - list user-course pairs with invoice status
router.get("/billing/invoices",verifyToken, isAdmin, listInvoicesController);



export default router;
