import express from "express";
import { getDarkMode, updateDarkMode } from "../controllers/darkModeController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get dark mode setting for a user
router.get("/:userId", protect, getDarkMode);

// Update dark mode setting for a user
router.put("/:userId", protect, updateDarkMode);

export default router;

