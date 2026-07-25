import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getVapidPublicKey, subscribe, unsubscribe } from "../controllers/pushController.js";

const router = express.Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe", protect, subscribe);
router.post("/unsubscribe", protect, unsubscribe);

export default router;
