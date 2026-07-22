import express from "express";
import { translateText } from "../controllers/translateController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, translateText);

export default router;
