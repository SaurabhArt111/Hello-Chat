import mongoose from "mongoose";
import ProfilePhotoPrivacy from "../models/ProfilePhotoPrivacy.js";
import FriendRequest from "../models/FriendRequest.js";

// Middleware to decide whether the viewer can see the target user's real avatar
export const checkProfilePhotoPrivacy = async (req, res, next) => {
  try {
    const viewerId = req.user; // set by authMiddleware
    const targetId = req.params.userId || req.params.id;

    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      // If we can't reliably determine target, don't interfere
      return next();
    }

    // User can always see their own photo
    if (viewerId && String(viewerId) === String(targetId)) {
      req.profilePhotoAllowed = true;
      return next();
    }

    // Load privacy setting for target user
    const settingDoc = await ProfilePhotoPrivacy.findOne({
      userId: targetId,
    }).lean();
    const setting = settingDoc?.profilePhoto || "everyone";

    if (setting === "everyone") {
      req.profilePhotoAllowed = true;
      return next();
    }

    if (setting === "nobody") {
      req.profilePhotoAllowed = false;
      return next();
    }

    // "contacts" – only allow if viewer is in target's contacts
    // A contact is any accepted FriendRequest between the two users
    const relation = await FriendRequest.findOne({
      status: "accepted",
      $or: [
        { sender: viewerId, receiver: targetId },
        { sender: targetId, receiver: viewerId },
      ],
    }).lean();

    req.profilePhotoAllowed = !!relation;
    return next();
  } catch (err) {
    console.error("checkProfilePhotoPrivacy error:", err);
    // On error, be conservative and hide photo
    req.profilePhotoAllowed = false;
    return next();
  }
};

