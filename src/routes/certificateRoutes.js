import { Router } from "express";
import {
  sendCertificateController,
  getCertificatesController,
  getCertificateByIdController,
} from "../controllers/certificateController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = Router();

// Send certificate
router.post("/send", verifyToken, isAdmin, sendCertificateController);

// Get all certificates
router.get("/", verifyToken, isAdmin, getCertificatesController);

// Get single certificate by id
router.get("/:id", verifyToken, isAdmin, getCertificateByIdController);

export default router;