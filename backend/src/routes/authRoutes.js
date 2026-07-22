import express from "express";
import { registerUser, login } from "../controllers/authController.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Authentication
router.post("/register", upload.single("avatar"), registerUser);
router.post("/login", login);

export default router;