import mongoose from "mongoose";
import Message from "../models/Message.js";
import FriendRequest from "../models/FriendRequest.js";

// POST /api/messages/upload
export const uploadFile = async (req, res) => {
  try {
    const { senderId, receiverId, groupId, messageType } = req.body;

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
    }

    let type = "file";
    if (messageType === "image") type = "image";
    else if (messageType === "video") type = "video";

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const relativePath = `/uploads/${req.file.filename}`;
    const fileUrl = `${baseUrl}${relativePath}`;
    const fileName = req.file.originalname;
    const fileSize = `${Math.round(req.file.size / 1024)} KB`;

    const message = new Message({
      sender: senderId,
      receiver: isGroup ? undefined : receiverId,
      group: isGroup ? groupId : undefined,
      messageType: type,
      type: type,
      fileUrl,
      fileName,
      fileSize,
      text: "",
    });

    const savedMessage = await message.save();

    try {
      const io = req.app.get("io");
      const onlineUsers = req.app.get("onlineUsers") || {};
      if (io) {
        const messagePayload = savedMessage.toObject ? savedMessage.toObject() : { ...savedMessage };
        if (isGroup) {
          io.to(String(groupId)).emit("receiveMessage", {
            senderId: String(senderId),
            groupId: String(groupId),
            message: messagePayload,
          });
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
            text: savedMessage.text || "",
            createdAt: savedMessage.createdAt,
          };
          io.to(String(receiverId)).emit("new_message", newMessagePayload);
          io.to(String(senderId)).emit("new_message", newMessagePayload);
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

