import mongoose from "mongoose";
import Message from "../models/Message.js";
import FriendRequest from "../models/FriendRequest.js";

// POST /api/messages/forward
export const forwardMessage = async (req, res) => {
  try {
    const { messageId, receiverIds } = req.body;
    const senderId = req.user;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    if (!Array.isArray(receiverIds) || receiverIds.length === 0) {
      return res.status(400).json({ message: "receiverIds must be a non-empty array" });
    }

    const original = await Message.findById(messageId).lean();
    if (!original) {
      return res.status(404).json({ message: "Original message not found" });
    }

    const validReceivers = receiverIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validReceivers.length === 0) {
      return res.status(400).json({ message: "No valid receiver IDs" });
    }

    const createdMessages = [];
    const ioPayloads = [];

    for (const rid of validReceivers) {
      // Only allow forwarding to friends
      const friendship = await FriendRequest.findOne({
        status: "accepted",
        $or: [
          { sender: senderId, receiver: rid },
          { sender: rid, receiver: senderId },
        ],
      }).lean();

      if (!friendship) continue;

      const forwardedMsg = await Message.create({
        sender: senderId,
        receiver: rid,
        text: original.text,
        type: original.type,
        messageType: original.messageType,
        fileUrl: original.fileUrl,
        fileName: original.fileName,
        fileSize: original.fileSize,
        forwarded: true,
        status: "sent",
      });

      createdMessages.push(forwardedMsg);

      ioPayloads.push({
        _id: forwardedMsg._id,
        senderId: forwardedMsg.sender,
        receiverId: forwardedMsg.receiver,
        text: forwardedMsg.text,
        messageType: forwardedMsg.messageType,
        fileUrl: forwardedMsg.fileUrl,
        fileName: forwardedMsg.fileName,
        fileSize: forwardedMsg.fileSize,
        forwarded: true,
        createdAt: forwardedMsg.createdAt,
      });
    }

    try {
      const io = req.app.get("io");
      if (io) {
        ioPayloads.forEach((payload) => {
          io.to(String(payload.receiverId)).emit("new_message", payload);
        });
      }
    } catch (err) {
      console.error("forwardMessage socket error:", err);
    }

    return res.json({
      count: createdMessages.length,
      messages: createdMessages,
    });
  } catch (err) {
    console.error("forwardMessage error:", err);
    return res.status(500).json({ error: err.message });
  }
};

