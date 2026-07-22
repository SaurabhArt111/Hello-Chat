import mongoose from "mongoose";
import Message from "../models/Message.js";

// POST /api/messages/react
export const addReaction = async (req, res) => {
  try {
    const { messageId, emoji } = req.body;
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.reactions) {
      message.reactions = [];
    }

    const existing = message.reactions.find(
      (r) => String(r.userId) === String(userId)
    );

    if (existing) {
      existing.emoji = emoji;
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    const ioPayload = {
      messageId: String(message._id),
      reactions: message.reactions.map((r) => ({
        userId: r.userId,
        emoji: r.emoji,
      })),
    };

    try {
      const io = req.app.get("io");
      if (io) {
        io.to(String(message.sender)).emit("message_reaction_update", ioPayload);
        io.to(String(message.receiver)).emit("message_reaction_update", ioPayload);
      }
    } catch (err) {
      console.error("addReaction socket error:", err);
    }

    return res.json(ioPayload);
  } catch (err) {
    console.error("addReaction error:", err);
    return res.status(500).json({ error: err.message });
  }
};

