import express from "express";
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  getIncomingRequests,
  getFriendsList,
  getAllUsers,
  blockFromRequest,
  undoReject,
} from "../controllers/friendRequestController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Request Actions
router.post("/send", protect, sendRequest);
router.post("/accept", protect, acceptRequest);
router.post("/accept/:requestId", protect, acceptRequest);
router.post("/reject", protect, rejectRequest);
router.post("/reject/:requestId", protect, rejectRequest);
router.post("/cancel", protect, cancelRequest);
router.delete("/cancel/:requestId", protect, cancelRequest);
router.post("/block-from-request/:requestId", protect, blockFromRequest);
router.post("/undo-reject/:requestId", protect, undoReject);

// Data Retrieval
router.get("/incoming", protect, getIncomingRequests);
router.get("/friends", protect, getFriendsList);
router.get("/all-users", protect, getAllUsers);

export default router;