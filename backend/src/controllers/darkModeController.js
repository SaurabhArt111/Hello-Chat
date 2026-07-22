import mongoose from "mongoose";
import DarkMode from "../models/DarkMode.js";

/* GET DARK MODE FOR USER */
export const getDarkMode = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Optional: ensure users can only access their own setting
    if (req.user && String(req.user) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized to view this setting" });
    }

    const setting = await DarkMode.findOne({ userId }).lean();

    res.json({
      userId,
      darkMode: setting?.darkMode ?? false,
    });
  } catch (err) {
    console.error("GET DARK MODE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

/* UPDATE DARK MODE FOR USER */
export const updateDarkMode = async (req, res) => {
  try {
    const { userId } = req.params;
    const { darkMode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (typeof darkMode !== "boolean") {
      return res.status(400).json({ message: "darkMode must be a boolean" });
    }

    // Optional: ensure users can only update their own setting
    if (req.user && String(req.user) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized to update this setting" });
    }

    const updated = await DarkMode.findOneAndUpdate(
      { userId },
      { userId, darkMode },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      userId: String(updated.userId),
      darkMode: updated.darkMode,
    });
  } catch (err) {
    console.error("UPDATE DARK MODE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

