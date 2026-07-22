import express from "express";
import {
  getLastSeenSetting,
  updateLastSeenSetting,
} from "../controllers/lastSeenController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/last-seen/:userId
router.get("/:userId", protect, getLastSeenSetting);

// PUT /api/last-seen/:userId
router.put("/:userId", protect, updateLastSeenSetting);

export default router;

