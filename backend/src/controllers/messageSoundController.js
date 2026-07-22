import mongoose from "mongoose";
import MessageSoundSetting from "../models/MessageSoundSetting.js";

const ensureOwner = (authUserId, targetUserId) => {
  return String(authUserId) === String(targetUserId);
};

export const getMessageSound = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let setting = await MessageSoundSetting.findOne({ userId }).lean();

    if (!setting) {
      setting = await MessageSoundSetting.create({ userId, messageSound: true });
      setting = setting.toObject();
    }

    return res.json({
      userId: String(setting.userId),
      messageSound: setting.messageSound,
    });
  } catch (err) {
    console.error("GET MESSAGE SOUND SETTING ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateMessageSound = async (req, res) => {
  try {
    const { userId } = req.params;
    const { messageSound } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (typeof messageSound !== "boolean") {
      return res.status(400).json({ message: "messageSound must be a boolean" });
    }

    const updated = await MessageSoundSetting.findOneAndUpdate(
      { userId },
      { userId, messageSound },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      userId: String(updated.userId),
      messageSound: updated.messageSound,
    });
  } catch (err) {
    console.error("UPDATE MESSAGE SOUND SETTING ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

