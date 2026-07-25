import express from "express";
import upload from "../middleware/memoryUpload.js";
import {
  updateProfile,
  setE2eePublicKey,
  getE2eePublicKey,
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
router.put("/e2ee-key", protect, setE2eePublicKey);
router.get("/:userId/e2ee-key", protect, getE2eePublicKey);
router.get("/:userId", protect, checkProfilePhotoPrivacy, getUserProfile);
router.delete("/me", protect, deleteMyAccount);

export default router;