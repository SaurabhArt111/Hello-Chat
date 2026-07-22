import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  blockUser,
  unblockUser,
  getBlockedList,
  checkBlocked,
  amBlocking,
} from "../controllers/blockController.js";

const router = express.Router();

router.post("/", protect, blockUser);
router.delete("/", protect, unblockUser);
router.get("/list/:userId", protect, getBlockedList);
router.get("/check/:userId", protect, checkBlocked);
router.get("/am-blocking/:userId", protect, amBlocking);

export default router;
