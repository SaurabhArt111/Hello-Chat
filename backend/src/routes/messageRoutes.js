import express from "express";
import {
  saveMessage,
  getMessages,
  getGroupMessages,
  syncMessages,
} from "../controllers/messageController.js";
import { markSeen } from "../controllers/readReceiptController.js";
import { editMessage } from "../controllers/messageEditController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Message Operations
router.post("/", protect, saveMessage);
router.get("/sync", protect, syncMessages);
router.post("/mark-seen", protect, markSeen);
router.put("/edit/:id", protect, editMessage);
router.get("/group/:groupId", protect, getGroupMessages);
router.get("/:user1/:user2", protect, getMessages);

export default router;