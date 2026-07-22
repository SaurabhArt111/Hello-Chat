import mongoose from "mongoose";
import Message from "../models/Message.js";

const ensureOwner = (authUserId, targetUserId) =>
  String(authUserId) === String(targetUserId);

const ensureParticipant = (authUserId, message) =>
  String(message.sender) === String(authUserId) ||
  String(message.receiver) === String(authUserId);

// DELETE /api/messages/delete-for-me/:id
export const deleteForMe = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!ensureParticipant(userId, message)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!message.deletedFor) {
      message.deletedFor = [];
    }

    if (!message.deletedFor.find((uid) => String(uid) === String(userId))) {
      message.deletedFor.push(userId);
      await message.save();
    }

    // Notify both participants that this user deleted the message for themselves
    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          messageId: String(message._id),
          userId: String(userId),
          scope: "me",
        };
        io.to(String(message.sender)).emit("message_deleted", payload);
        io.to(String(message.receiver)).emit("message_deleted", payload);
      }
    } catch (err) {
      console.error("deleteForMe socket error:", err);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("deleteForMe error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/messages/delete-for-everyone/:id
export const deleteForEveryone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!ensureOwner(userId, message.sender)) {
      return res.status(403).json({ message: "Only sender can delete for everyone" });
    }

    message.deletedForEveryone = true;
    message.text = "This message was deleted";
    message.fileUrl = null;
    message.fileName = null;
    message.fileSize = null;
    message.type = "text";
    message.messageType = "text";

    await message.save();

    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          messageId: String(message._id),
          scope: "everyone",
          text: message.text,
        };
        io.to(String(message.sender)).emit("message_deleted", payload);
        io.to(String(message.receiver)).emit("message_deleted", payload);
      }
    } catch (err) {
      console.error("deleteForEveryone socket error:", err);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("deleteForEveryone error:", err);
    return res.status(500).json({ error: err.message });
  }
};

