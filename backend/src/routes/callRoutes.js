import express from "express";
import { getCallHistory, startCall, endCall } from "../controllers/callController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Call Operations
router.get("/history", protect, getCallHistory);
router.post("/start", protect, startCall);
router.post("/end", protect, endCall);

export default router;
