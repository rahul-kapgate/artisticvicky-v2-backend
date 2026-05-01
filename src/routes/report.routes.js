import express from "express";
import { sendDailyReport } from "../controllers/report.controller.js";

const router = express.Router();

// GET /api/report/daily
router.get("/daily", sendDailyReport);

export default router;
