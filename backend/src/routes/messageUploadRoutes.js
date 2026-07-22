import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadFile } from "../controllers/messageUploadController.js";

const router = express.Router();

// POST /api/messages/upload
router.post("/upload", protect, upload.single("file"), uploadFile);

export default router;

