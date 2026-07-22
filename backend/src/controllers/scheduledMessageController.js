import mongoose from "mongoose";
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import FriendRequest from "../models/FriendRequest.js";
import { isBlocked } from "./blockController.js";

/* SCHEDULE MESSAGE */
export const scheduleMessage = async (req, res) => {
  try {
    const { receiver, group, text, type = "text", file, fileUrl, fileName, fileSize, scheduledFor } = req.body;
    const senderId = req.user;

    // Validate input
    if (!scheduledFor || (!receiver && !group) || (!text && !file && !fileUrl)) {
      return res.status(400).json({ 
        message: "Receiver/group, content, and scheduled time are required" 
      });
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({ message: "Scheduled time must be in the future" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({ message: "Invalid sender ID" });
    }

    // If receiver (1-on-1), check friendship
    if (receiver) {
      if (!mongoose.Types.ObjectId.isValid(receiver)) {
        return res.status(400).json({ message: "Invalid receiver ID" });
      }

      const friendship = await FriendRequest.findOne({
        $or: [
          { sender: senderId, receiver: receiver },
          { sender: receiver, receiver: senderId },
        ],
        status: "accepted",
      }).lean();

      if (!friendship) {
        return res.status(403).json({ message: "You can only schedule messages to friends" });
      }

      if (await isBlocked(receiver, senderId)) {
        return res.status(403).json({ message: "You cannot send messages to this user" });
      }
    }

    // If group, check membership
    if (group) {
      if (!mongoose.Types.ObjectId.isValid(group)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      const groupDoc = await Group.findOne({
        _id: group,
        "members.user": senderId,
        isActive: true,
      }).lean();

      if (!groupDoc) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }
    }

    // Create message in "scheduled" state. Do NOT emit now.
    const scheduledMessage = new Message({
      sender: new mongoose.Types.ObjectId(senderId),
      receiver: receiver ? new mongoose.Types.ObjectId(receiver) : undefined,
      group: group ? new mongoose.Types.ObjectId(group) : undefined,
      text: text?.trim?.() ?? text,
      type,
      messageType: type,
      file,
      fileUrl,
      fileName,
      fileSize,
      scheduledFor: scheduledDate, // stored as UTC Date
      status: "scheduled",
    });

    await scheduledMessage.save();

    return res.status(201).json({
      message: "Message scheduled successfully",
      scheduledMessage,
    });
  } catch (err) {
    console.error("SCHEDULE MESSAGE ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET SCHEDULED MESSAGES */
export const getScheduledMessages = async (req, res) => {
  try {
    const userId = req.user;

    const scheduledMessages = await Message.find({
      sender: userId,
      status: "scheduled",
      scheduledFor: { $gt: new Date() },
    })
      .populate("receiver", "username avatar bio")
      .populate("group", "name avatar")
      .sort({ scheduledFor: 1 })
      .lean();

    return res.json({ scheduledMessages });
  } catch (err) {
    console.error("GET SCHEDULED MESSAGES ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* CANCEL SCHEDULED MESSAGE */
export const cancelScheduledMessage = async (req, res) => {
  try {
    const { scheduledMessageId } = req.params;
    const userId = req.user;

    const scheduledMessage = await Message.findOne({
      _id: scheduledMessageId,
      sender: userId,
      status: "scheduled",
    });

    if (!scheduledMessage) {
      return res.status(404).json({ message: "Scheduled message not found" });
    }

    scheduledMessage.status = "cancelled";
    await scheduledMessage.save();

    return res.json({ message: "Scheduled message cancelled" });
  } catch (err) {
    console.error("CANCEL SCHEDULED MESSAGE ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/**
 * PROCESS DUE SCHEDULED MESSAGES (server-side scheduler; run every second)
 * - Atomically claims due messages to avoid duplicate sends
 * - Emits to both sender and receiver (or group members) via Socket.io
 */
export const processScheduledMessages = async (io) => {
  try {
    const now = new Date();

    // Claim+dispatch in small batches each tick
    const MAX_PER_TICK = 50;
    let processed = 0;

    while (processed < MAX_PER_TICK) {
      const due = await Message.findOneAndUpdate(
        {
          status: "scheduled",
          scheduledFor: { $lte: now },
        },
        {
          $set: {
            status: "sent",
            sentAt: now,
            // Ensure ordering/UX matches actual send time
            createdAt: now,
            updatedAt: now,
          },
        },
        { new: true }
      )
        .populate("sender", "username avatar")
        .populate("receiver", "username avatar")
        .lean();

      if (!due) break;
      processed += 1;

      try {
        // 1-on-1
        if (due.receiver && !due.group) {
          const receiverId = String(due.receiver._id || due.receiver);
          const senderId = String(due.sender?._id || due.sender);

          if (await isBlocked(receiverId, senderId)) {
            // If blocked at send time, mark cancelled (do not emit)
            await Message.updateOne(
              { _id: due._id },
              { $set: { status: "cancelled", updatedAt: new Date() } }
            );
            continue;
          }

          const payload = {
            senderId,
            receiverId,
            message: due,
          };
          io.to(receiverId).emit("receiveMessage", payload);
          io.to(receiverId).emit("receive_message", payload);
          io.to(senderId).emit("receiveMessage", payload);
          io.to(senderId).emit("receive_message", payload);
          continue;
        }

        // Group
        if (due.group) {
          const groupId = String(due.group._id || due.group);
          const senderId = String(due.sender?._id || due.sender);

          const groupDoc = await Group.findById(groupId)
            .populate("members.user", "username avatar preferredLanguage")
            .lean();
          if (!groupDoc || !groupDoc.isActive) continue;

          const memberIds = (groupDoc.members || []).map((m) =>
            String(m.user?._id || m.user)
          );

          for (const memberId of memberIds) {
            if (memberId === senderId) {
              io.to(memberId).emit("receiveMessage", {
                senderId,
                groupId,
                message: { ...due, translatedText: due.originalText || due.text },
              });
              io.to(memberId).emit("receive_message", {
                senderId,
                groupId,
                message: { ...due, translatedText: due.originalText || due.text },
              });
            } else {
              let translatedMsg = due;
              if (due.groupTranslations) {
                const userTranslation = due.groupTranslations.find(
                  (t) => String(t.userId?._id || t.userId) === String(memberId)
                );
                translatedMsg = {
                  ...due,
                  translatedText: userTranslation?.translatedText || due.text,
                };
              }
              io.to(memberId).emit("receiveMessage", { senderId, groupId, message: translatedMsg });
              io.to(memberId).emit("receive_message", { senderId, groupId, message: translatedMsg });
            }
          }

          io.to(groupId).emit("groupMessage", { senderId, groupId, message: due });
          io.to(groupId).emit("group_message", { senderId, groupId, message: due });
        }
      } catch (err) {
        console.error(`Error dispatching scheduled message ${due._id}:`, err);
        // Best-effort: mark cancelled to avoid infinite retry loops
        await Message.updateOne(
          { _id: due._id },
          { $set: { status: "cancelled", updatedAt: new Date() } }
        );
      }
    }
  } catch (err) {
    console.error("PROCESS SCHEDULED MESSAGES ERROR:", err);
  }
};
