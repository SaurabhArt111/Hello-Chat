import mongoose from "mongoose";
import LastSeenSetting from "../models/LastSeenSetting.js";

const ensureOwner = (authUserId, targetUserId) => {
  return String(authUserId) === String(targetUserId);
};

export const getLastSeenSetting = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let setting = await LastSeenSetting.findOne({ userId }).lean();

    if (!setting) {
      setting = await LastSeenSetting.create({ userId, lastSeen: "everyone" });
      setting = setting.toObject();
    }

    return res.json({
      userId: String(setting.userId),
      lastSeen: setting.lastSeen,
    });
  } catch (err) {
    console.error("GET LAST SEEN SETTING ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateLastSeenSetting = async (req, res) => {
  try {
    const { userId } = req.params;
    const { lastSeen } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const allowed = ["everyone", "contacts", "nobody"];
    if (!allowed.includes(lastSeen)) {
      return res.status(400).json({ message: "Invalid lastSeen value" });
    }

    const updated = await LastSeenSetting.findOneAndUpdate(
      { userId },
      { userId, lastSeen },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      userId: String(updated.userId),
      lastSeen: updated.lastSeen,
    });
  } catch (err) {
    console.error("UPDATE LAST SEEN SETTING ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

