import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  deleteForMe,
  deleteForEveryone,
} from "../controllers/messageDeleteController.js";
import { addReaction } from "../controllers/messageReactionController.js";
import { forwardMessage } from "../controllers/messageForwardController.js";

const router = express.Router();

// Delete for me
router.delete("/delete-for-me/:id", protect, deleteForMe);

// Delete for everyone
router.delete("/delete-for-everyone/:id", protect, deleteForEveryone);

// React to message
router.post("/react", protect, addReaction);

// Forward message
router.post("/forward", protect, forwardMessage);

export default router;

