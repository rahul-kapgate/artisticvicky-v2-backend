import express from "express";
import {
  upload,
  createResource,
  getAllResources,
  updateResource,
  deleteResource,
  streamResourceFile,
} from "../controllers/resourceController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// ✅ Only admin can upload new resource
router.post(
  "/add-resource",
  verifyToken,
  isAdmin,
  upload.single("file"),
  createResource
);

// ✅ Only admin can update a resource
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.single("file"),
  updateResource
);

// ✅ Only admin can delete a resource
router.delete("/:id", verifyToken, isAdmin, deleteResource);

// ✅ Public route — anyone can view
router.get("/all-resources", verifyToken, getAllResources);

// ✅ Authenticated users can stream the actual file
router.get("/:id/file", verifyToken, streamResourceFile);

export default router;
