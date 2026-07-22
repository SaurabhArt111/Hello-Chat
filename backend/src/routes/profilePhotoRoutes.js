import express from "express";
import {
  getProfilePhotoPrivacy,
  updateProfilePhotoPrivacy,
} from "../controllers/profilePhotoController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/profile-photo-privacy/:userId
router.get("/:userId", protect, getProfilePhotoPrivacy);

// PUT /api/profile-photo-privacy/:userId
router.put("/:userId", protect, updateProfilePhotoPrivacy);

export default router;

