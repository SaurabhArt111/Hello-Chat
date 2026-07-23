import mongoose from "mongoose";
import Message from "../models/Message.js";

// GET /api/shared-media/:currentUserId/:selectedUserId
export const getSharedMedia = async (req, res) => {
  try {
    const { currentUserId, selectedUserId } = req.params;
    const authUserId = req.user; // set by authMiddleware

    // Basic validation
    if (
      !mongoose.Types.ObjectId.isValid(currentUserId) ||
      !mongoose.Types.ObjectId.isValid(selectedUserId)
    ) {
      return res.status(400).json({ message: "Invalid user IDs" });
    }

    // Ensure the authenticated user is part of the conversation
    if (
      String(authUserId) !== String(currentUserId) &&
      String(authUserId) !== String(selectedUserId)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this conversation" });
    }

    const page = parseInt(req.query.page || "1", 10);
    const limit = Math.min(
      parseInt(req.query.limit || "50", 10),
      100
    );
    const skip = (page - 1) * limit;

    const cid = new mongoose.Types.ObjectId(currentUserId);
    const sid = new mongoose.Types.ObjectId(selectedUserId);

    // Messages between these two users that have media, file, or link content
    const baseQuery = {
      $and: [
        {
          $or: [
            { sender: cid, receiver: sid },
            { sender: sid, receiver: cid },
          ],
        },
        {
          $or: [
            { messageType: { $in: ["image", "video", "file"] } },
            { type: { $in: ["image", "video", "file"] } },
            { messageType: "link" },
            { messageType: "text", text: { $regex: /https?:\/\//i } },
            { type: "text", text: { $regex: /https?:\/\//i } },
            { fileUrl: { $exists: true, $ne: null, $nin: [""] } },
            { file: { $exists: true, $ne: null, $nin: [""] } },
          ],
        },
      ],
    };

    const messages = await Message.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Helper to normalize message type & file fields
    const normalize = (m) => {
      const messageType = m.messageType || m.type || "text";
      let fileUrl = m.fileUrl || m.file || null;

      if (fileUrl && !/^https?:\/\//i.test(fileUrl)) {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        if (!fileUrl.startsWith("/")) {
          fileUrl = `/${fileUrl}`;
        }
        fileUrl = `${baseUrl}${fileUrl}`;
      }

      return {
        _id: m._id?.toString?.() ?? m._id,
        senderId: m.sender?.toString?.() ?? m.sender,
        receiverId: m.receiver?.toString?.() ?? m.receiver,
        messageType,
        fileUrl: fileUrl || null,
        fileName: m.fileName || null,
        fileSize: m.fileSize || null,
        text: m.text || "",
        createdAt: m.createdAt,
      };
    };

    const normalized = messages.map(normalize);

    const media = normalized.filter(
      (m) => ["image", "video"].includes(m.messageType) && m.fileUrl
    );
    const files = normalized.filter(
      (m) =>
        (m.messageType === "file" || (m.messageType === "text" && m.fileUrl)) &&
        m.fileUrl
    );
    const urlRegex = /https?:\/\/\S+/i;
    const links = normalized.filter(
      (m) =>
        m.messageType === "link" ||
        (m.messageType === "text" && !m.fileUrl && urlRegex.test(m.text || ""))
    );

    res.json({
      media,
      files,
      links,
      pagination: {
        page,
        limit,
        count: messages.length,
        hasMore: messages.length === limit,
      },
    });
  } catch (err) {
    console.error("GET SHARED MEDIA ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

