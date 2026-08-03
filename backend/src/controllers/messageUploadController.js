import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import { saveMessageMediaBuffer } from "../utils/mediaStorage.js";
import { buildFileUrl } from "../utils/buildFileUrl.js";
import { sendMessagePush } from "../utils/webPush.js";

// POST /api/messages/upload
export const uploadFile = async (req, res) => {
  try {
    const { senderId, receiverId, groupId, messageType, duration, text } = req.body;

    if (!senderId || !req.file) {
      return res
        .status(400)
        .json({ message: "senderId and file are required" });
    }

    const isGroup = !!groupId;
    if (!isGroup && !receiverId) {
      return res.status(400).json({ message: "receiverId or groupId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({ message: "Invalid sender ID" });
    }

    let conversation = null;

    if (isGroup) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }
      const Group = (await import("../models/Group.js")).default;
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const isMember = group.members?.some(
        (m) => String(m.user || m) === String(senderId)
      );
      if (!isMember) {
        return res.status(403).json({ message: "You must be a group member to send media" });
      }
    } else {
      if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ message: "Invalid receiver ID" });
      }
      const friendship = await FriendRequest.findOne({
        status: "accepted",
        $or: [
          { sender: senderId, receiver: receiverId },
          { sender: receiverId, receiver: senderId },
        ],
      }).lean();
      if (!friendship) {
        return res.status(403).json({ message: "You can only send media to friends" });
      }
      conversation = await Conversation.findOrCreateDirect(senderId, receiverId);
    }

    let type = "file";
    if (messageType === "image") type = "image";
    else if (messageType === "video") type = "video";
    else if (messageType === "voice") type = "voice";

    // Save to local disk under backend/uploads (see utils/mediaStorage.js).
    // Images are re-compressed server-side as a safety net; the client
    // already compresses before upload.
    const saved = await saveMessageMediaBuffer(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });

    let fileUrl = saved.url;
    if (fileUrl && fileUrl.startsWith("/uploads/")) {
      fileUrl = buildFileUrl(req, fileUrl);
    }
    const fileName = req.file.originalname;
    const fileSize = `${Math.round(req.file.size / 1024)} KB`;
    // Voice notes: trust the client-measured duration if it's a real,
    // finite number (this is exactly what fixes the "Infinity:NaN" bug -
    // we now validate here AND on the client before ever rendering it).
    const numericDuration = Number(duration);
    const safeDuration = Number.isFinite(numericDuration) && numericDuration > 0 ? numericDuration : undefined;

    const message = new Message({
      sender: senderId,
      receiver: isGroup ? undefined : receiverId,
      group: isGroup ? groupId : undefined,
      conversationId: conversation ? conversation._id : undefined,
      messageType: type,
      type: type,
      fileUrl,
      fileName,
      fileSize,
      filePublicId: saved.publicId,
      duration: safeDuration,
      attachments: [
        {
          url: fileUrl,
          publicId: saved.publicId,
          mimeType: req.file.mimetype,
          fileName,
          fileSize: req.file.size,
          width: saved.width,
          height: saved.height,
          duration: safeDuration ?? saved.duration,
        },
      ],
      text: typeof text === "string" ? text.slice(0, 2000) : "",
    });

    const savedMessage = await message.save();

    if (conversation) {
      await Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessage: { text: `📎 ${type}`, messageType: type, senderId, encrypted: false },
            lastMessageAt: savedMessage.createdAt || new Date(),
          },
          $inc: { [`unreadCount.${String(receiverId)}`]: 1 },
        }
      ).catch(() => {});
    }

    try {
      const io = req.app.get("io");
      const onlineUsers = req.app.get("onlineUsers") || {};
      const preview =
        (typeof text === "string" && text.trim()) ||
        (type === "image" ? "📷 Photo" : type === "video" ? "🎥 Video" : type === "voice" ? "🎤 Voice message" : "Sent an attachment");

      if (io) {
        const messagePayload = savedMessage.toObject ? savedMessage.toObject() : { ...savedMessage };
        if (isGroup) {
          io.to(String(groupId)).emit("receiveMessage", {
            senderId: String(senderId),
            groupId: String(groupId),
            message: messagePayload,
          });

          // Push to any group member with no active socket at all - the
          // room emit above never reaches them. Re-fetch with populated
          // usernames since the earlier group lookup is out of scope here
          // and only had raw member refs.
          const GroupModel = (await import("../models/Group.js")).default;
          const groupWithMembers = await GroupModel.findById(groupId)
            .populate("members.user", "username")
            .lean();
          const senderMember = groupWithMembers?.members?.find(
            (m) => String(m.user?._id || m.user) === String(senderId)
          );
          const senderName = senderMember?.user?.username || "Someone";
          for (const m of groupWithMembers?.members || []) {
            const memberId = String(m.user?._id || m.user);
            if (memberId === String(senderId)) continue;
            if (!onlineUsers[memberId]) {
              sendMessagePush(memberId, {
                senderName: groupWithMembers.name ? `${senderName} (${groupWithMembers.name})` : senderName,
                preview,
              }).catch(() => {});
            }
          }
        } else {
          const receiverSocket = onlineUsers[String(receiverId)];
          if (receiverSocket) {
            io.to(receiverSocket).emit("receiveMessage", {
              senderId: String(senderId),
              message: messagePayload,
            });
          }
          const newMessagePayload = {
            _id: savedMessage._id,
            senderId: String(savedMessage.sender),
            receiverId: String(savedMessage.receiver),
            messageType: savedMessage.messageType || savedMessage.type,
            fileUrl: savedMessage.fileUrl,
            fileName: savedMessage.fileName,
            fileSize: savedMessage.fileSize,
            duration: savedMessage.duration,
            text: savedMessage.text || "",
            createdAt: savedMessage.createdAt,
          };
          io.to(String(receiverId)).emit("new_message", newMessagePayload);
          io.to(String(senderId)).emit("new_message", newMessagePayload);

          if (!onlineUsers[String(receiverId)]) {
            User.findById(senderId)
              .select("username")
              .lean()
              .then((senderUser) => sendMessagePush(receiverId, { senderName: senderUser?.username || "New message", preview }))
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Error emitting for upload:", err);
    }

    const response = {
      ...savedMessage.toObject(),
      fileUrl,
    };

    return res.status(201).json(response);
  } catch (err) {
    console.error("UPLOAD MESSAGE ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};
