import express from "express";
import {
  scheduleMessage,
  getScheduledMessages,
  cancelScheduledMessage,
} from "../controllers/scheduledMessageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, scheduleMessage);
router.get("/", protect, getScheduledMessages);
router.delete("/:scheduledMessageId", protect, cancelScheduledMessage);

export default router;
