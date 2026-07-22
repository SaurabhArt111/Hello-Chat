import express from "express";
import { getSharedMedia } from "../controllers/sharedMediaController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/shared-media/:currentUserId/:selectedUserId
router.get("/:currentUserId/:selectedUserId", protect, getSharedMedia);

export default router;

