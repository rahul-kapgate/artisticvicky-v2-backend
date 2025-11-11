import express from "express";
import {
    addVideo,
    getVideos,
    getVideoById,
    updateVideo,
    deleteVideo,
} from "../controllers/videoController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Admin
router.post("/", verifyToken, isAdmin, addVideo);
router.put("/:id", verifyToken, isAdmin, updateVideo);
router.delete("/:id", verifyToken, isAdmin, deleteVideo);

// Public
router.get("/", verifyToken, getVideos);
router.get("/:id", verifyToken, getVideoById);

export default router;
