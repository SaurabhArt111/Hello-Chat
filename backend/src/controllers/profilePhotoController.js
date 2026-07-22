import mongoose from "mongoose";
import ProfilePhotoPrivacy from "../models/ProfilePhotoPrivacy.js";

const ensureOwner = (authUserId, targetUserId) => {
  return String(authUserId) === String(targetUserId);
};

export const getProfilePhotoPrivacy = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let setting = await ProfilePhotoPrivacy.findOne({ userId }).lean();

    if (!setting) {
      setting = await ProfilePhotoPrivacy.create({
        userId,
        profilePhoto: "everyone",
      });
      setting = setting.toObject();
    }

    return res.json({
      userId: String(setting.userId),
      profilePhoto: setting.profilePhoto,
    });
  } catch (err) {
    console.error("GET PROFILE PHOTO PRIVACY ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateProfilePhotoPrivacy = async (req, res) => {
  try {
    const { userId } = req.params;
    const { profilePhoto } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const allowed = ["everyone", "contacts", "nobody"];
    if (!allowed.includes(profilePhoto)) {
      return res.status(400).json({ message: "Invalid profilePhoto value" });
    }

    const updated = await ProfilePhotoPrivacy.findOneAndUpdate(
      { userId },
      { userId, profilePhoto },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      userId: String(updated.userId),
      profilePhoto: updated.profilePhoto,
    });
  } catch (err) {
    console.error("UPDATE PROFILE PHOTO PRIVACY ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

