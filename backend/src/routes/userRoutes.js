import express from "express";
import upload from "../middleware/upload.js";
import {
  updateProfile,
  getUserProfile,
  searchUsers,
  getDiscoverUsers,
  getContacts,
  deleteMyAccount,
} from "../controllers/userController.js";

import {
  saveLanguage,
  getLanguage,
  getAvailableLanguages,
} from "../controllers/languageController.js";

import { protect } from "../middleware/authMiddleware.js";
import { checkProfilePhotoPrivacy } from "../middleware/checkProfilePhotoPrivacy.js";

const router = express.Router();

// Language preference
router.get("/languages", protect, getAvailableLanguages);
router.post("/language", protect, saveLanguage);
router.get("/language/:userId", protect, getLanguage);

// Smart search
router.get("/search", protect, searchUsers);

// Discover and Contacts
router.get("/discover", protect, getDiscoverUsers);
router.get("/contacts", protect, getContacts);

// Profile Operations
router.put("/update", protect, upload.single("avatar"), updateProfile);
router.get("/:userId", protect, checkProfilePhotoPrivacy, getUserProfile);
router.delete("/me", protect, deleteMyAccount);

export default router;