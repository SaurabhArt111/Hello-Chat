import express from "express";
import {
  getNotifications,
  updateNotificationSetting,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/notifications/:userId
router.get("/:userId", protect, getNotifications);

// PUT /api/notifications/:userId  (toggle on/off)
router.put("/:userId", protect, updateNotificationSetting);

// PATCH /api/notifications/read/:id  (mark one notification as read)
router.patch("/read/:id", protect, markNotificationRead);

export default router;

