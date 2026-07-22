import mongoose from "mongoose";
import BlockedUser from "../models/BlockedUser.js";

/** Check if blockerId has blocked blockedUserId */
export const isBlocked = async (blockerId, blockedUserId) => {
  if (!blockerId || !blockedUserId) return false;
  const doc = await BlockedUser.findOne({
    blockerId: new mongoose.Types.ObjectId(blockerId),
    blockedUserId: new mongoose.Types.ObjectId(blockedUserId),
  }).lean();
  return !!doc;
};

/** POST /api/block - block a user */
export const blockUser = async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    const blockerId = req.user;

    if (!blockedUserId) {
      return res.status(400).json({ message: "blockedUserId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(blockedUserId)) {
      return res.status(400).json({ message: "Invalid blockedUserId" });
    }
    if (String(blockerId) === String(blockedUserId)) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }

    const existing = await BlockedUser.findOne({
      blockerId,
      blockedUserId,
    });
    if (existing) {
      return res.status(200).json({ message: "User already blocked", data: existing });
    }

    const doc = await BlockedUser.create({
      blockerId,
      blockedUserId,
    });
    return res.status(201).json({ message: "User blocked", data: doc });
  } catch (err) {
    console.error("BLOCK USER ERROR:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};

/** DELETE /api/block - unblock (body: { blockedUserId } or query) */
export const unblockUser = async (req, res) => {
  try {
    const blockedUserId = req.body?.blockedUserId || req.query?.blockedUserId;
    const blockerId = req.user;

    if (!blockedUserId) {
      return res.status(400).json({ message: "blockedUserId is required" });
    }

    const result = await BlockedUser.deleteOne({
      blockerId,
      blockedUserId,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Block not found" });
    }
    return res.json({ message: "User unblocked" });
  } catch (err) {
    console.error("UNBLOCK ERROR:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};

/** GET /api/block/list/:userId - list users blocked by userId (must be self) */
export const getBlockedList = async (req, res) => {
  try {
    const { userId } = req.params;
    const authId = req.user;

    if (String(authId) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const list = await BlockedUser.find({ blockerId: userId })
      .populate("blockedUserId", "username avatar")
      .lean();

    const data = list.map((l) => ({
      _id: l._id,
      blockedUserId: l.blockedUserId?._id,
      username: l.blockedUserId?.username,
      avatar: l.blockedUserId?.avatar,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("GET BLOCKED LIST ERROR:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};

/** GET /api/block/check/:userId - check if current user is blocked by userId (for presence hiding) */
export const checkBlocked = async (req, res) => {
  try {
    const { userId } = req.params; // the user whose profile/presence we're checking
    const currentUserId = req.user;

    const blocked = await BlockedUser.findOne({
      blockerId: userId,
      blockedUserId: currentUserId,
    }).lean();

    return res.json({ blocked: !!blocked });
  } catch (err) {
    console.error("CHECK BLOCKED ERROR:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};

/** GET /api/block/am-blocking/:userId - check if current user is blocking userId */
export const amBlocking = async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user;

    const doc = await BlockedUser.findOne({
      blockerId,
      blockedUserId: userId,
    }).lean();

    return res.json({ blocking: !!doc });
  } catch (err) {
    console.error("AM BLOCKING ERROR:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
};
