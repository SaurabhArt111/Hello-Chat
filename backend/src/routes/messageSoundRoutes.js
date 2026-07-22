import express from "express";
import {
  getMessageSound,
  updateMessageSound,
} from "../controllers/messageSoundController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/message-sound/:userId
router.get("/:userId", protect, getMessageSound);

// PUT /api/message-sound/:userId
router.put("/:userId", protect, updateMessageSound);

export default router;

