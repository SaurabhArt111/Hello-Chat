import express from "express";
import { getRecentChats } from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Recent Chats
router.get("/recent", protect, getRecentChats);

export default router;
