import mongoose from "mongoose";
import Message from "../models/Message.js";

/**
 * POST /api/messages/mark-seen
 * Body: { chatUserId, currentUserId }
 * Marks all messages from chatUserId to currentUserId as seen.
 */
export const markSeen = async (req, res) => {
  try {
    const { chatUserId, currentUserId } = req.body;
    const authUserId = req.user;

    if (!chatUserId || !currentUserId) {
      return res.status(400).json({ message: "chatUserId and currentUserId are required" });
    }
    if (String(authUserId) !== String(currentUserId)) {
      return res.status(403).json({ message: "Not authorized to mark as seen for another user" });
    }

    const result = await Message.updateMany(
      {
        sender: new mongoose.Types.ObjectId(chatUserId),
        receiver: new mongoose.Types.ObjectId(currentUserId),
        status: { $ne: "seen" },
      },
      { $set: { status: "seen", seenAt: new Date() } }
    );

    const io = req.app.get("io");
    if (io && result.modifiedCount > 0) {
      // Emit to sender room to support multi-device/tabs.
      io.to(String(chatUserId)).emit("updateStatus", {
        receiverId: String(currentUserId),
        status: "seen",
      });
    }

    return res.json({
      message: "Messages marked as seen",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("MARK SEEN ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};
