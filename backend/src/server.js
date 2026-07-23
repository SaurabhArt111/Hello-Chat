import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import messageRoutes from "./routes/messageRoutes.js";
import friendRequestRoutes from "./routes/friendRequestRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import darkModeRoutes from "./routes/darkModeRoutes.js";
import sharedMediaRoutes from "./routes/sharedMediaRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import messageSoundRoutes from "./routes/messageSoundRoutes.js";
import lastSeenRoutes from "./routes/lastSeenRoutes.js";
import profilePhotoRoutes from "./routes/profilePhotoRoutes.js";
import messageUploadRoutes from "./routes/messageUploadRoutes.js";
import messageActionsRoutes from "./routes/messageActionsRoutes.js";
import translateRoutes from "./routes/translateRoutes.js";
import blockRoutes from "./routes/blockRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import scheduledMessageRoutes from "./routes/scheduledMessageRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

import {
  handleUserOnline,
  handleUserOffline,
} from "./controllers/lastSeenRealtimeController.js";

import { isBlocked } from "./controllers/blockController.js";
import Message from "./models/Message.js";
import Group from "./models/Group.js";
import Call from "./models/Call.js";
import Notification from "./models/Notification.js";
import { processScheduledMessages } from "./controllers/scheduledMessageController.js";
import { processSelfDestructingGroups } from "./controllers/groupDestructController.js";
import User from "./models/User.js";
import os from "os";

dotenv.config();

const app = express();
const httpServer = createServer(app);

/* ---------------- ONLINE USERS MAP ---------------- */
// For compatibility with existing controllers: map userId -> roomName (same string).
// Emitting to io.to(onlineUsers[userId]) will broadcast to *all* sockets for that user.
let onlineUsers = {};
app.set("onlineUsers", onlineUsers);

// Internal connection tracking
const userSockets = new Map(); // userId -> Set(socketId)
const userDeviceSockets = new Map(); // userId -> Map(deviceId -> socketId)

/* ---------------- CORS / SOCKET.IO ---------------- */
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));

const io = new Server(httpServer, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: corsOptions.credentials,
  },
});

app.set("io", io);

/* ---------------- SOCKET AUTH (non-breaking) ---------------- */
// If the client provides a JWT in handshake auth, validate it and attach userId.
// We keep this non-breaking by allowing unauthenticated sockets; the app still uses `join`.
io.use((socket, next) => {
  const token = socket.handshake?.auth?.token;
  const userId = socket.handshake?.auth?.userId;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.authUserId = decoded?.id;
    if (userId && decoded?.id && String(userId) !== String(decoded.id)) {
      return next(new Error("Socket auth userId mismatch"));
    }
    return next();
  } catch (e) {
    return next(new Error("Socket auth failed"));
  }
});

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ---------------- ROUTES ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/messages", messageUploadRoutes);
app.use("/api/messages", messageActionsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/friends", friendRequestRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/darkmode", darkModeRoutes);
app.use("/api/shared-media", sharedMediaRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/message-sound", messageSoundRoutes);
app.use("/api/last-seen", lastSeenRoutes);
app.use("/api/profile-photo-privacy", profilePhotoRoutes);
app.use("/api/translate", translateRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/scheduled-messages", scheduledMessageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
  res.send("API running...");
});

/* ---------------- SOCKET LOGIC ---------------- */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const getOnlineList = () => Object.keys(onlineUsers);

  const registerSocketForUser = ({ userId, deviceId }) => {
    if (!userId) return;
    const uid = String(userId);
    const did = deviceId ? String(deviceId) : null;

    // Enforce single active socket per (userId, deviceId) without blocking multi-device.
    if (did) {
      const deviceMap = userDeviceSockets.get(uid) || new Map();
      const prevSocketId = deviceMap.get(did);
      if (prevSocketId && prevSocketId !== socket.id) {
        const prevSocket = io.sockets.sockets.get(prevSocketId);
        if (prevSocket) prevSocket.disconnect(true);
      }
      deviceMap.set(did, socket.id);
      userDeviceSockets.set(uid, deviceMap);
      socket.data.deviceId = did;
    }

    const set = userSockets.get(uid) || new Set();
    set.add(socket.id);
    userSockets.set(uid, set);

    // Compatibility: map uid -> roomName (uid)
    onlineUsers[uid] = uid;
    app.set("onlineUsers", onlineUsers);

    socket.data.userId = uid;
    socket.join(uid);

    handleUserOnline(uid, io, onlineUsers);

    const list = getOnlineList();
    io.emit("onlineUsers", list);
    io.emit("online_users", list);
  };

  socket.on("join", (payload) => {
    // Backwards compatible: join(userId) OR join({ userId, deviceId })
    const userIdFromPayload =
      typeof payload === "object" && payload !== null ? payload.userId : payload;
    const deviceIdFromPayload =
      typeof payload === "object" && payload !== null ? payload.deviceId : undefined;

    const userId = socket.data.authUserId || userIdFromPayload;
    const deviceId = socket.handshake?.auth?.deviceId || deviceIdFromPayload;
    if (!userId) return;

    registerSocketForUser({ userId, deviceId });
  });

  const handleSendMessage = async ({ senderId, receiverId, groupId, message }) => {
    try {
      // Handle group messages
      if (groupId) {
        const group = await Group.findById(groupId).populate("members.user").lean();
        if (!group || !group.isActive) return;

        // Check if sender is a member
        const isMember = group.members.some((m) => String(m.user._id || m.user) === String(senderId));
        if (!isMember) return;

        // Emit to all group members with their personalized translations
        const memberIds = group.members.map((m) => String(m.user._id || m.user));

        for (const memberId of memberIds) {
          if (String(memberId) === String(senderId)) {
            // Sender sees original
            io.to(String(memberId)).emit("receiveMessage", {
              senderId,
              groupId,
              message: {
                ...message,
                translatedText: message?.originalText || message?.text,
              },
            });
            io.to(String(memberId)).emit("receive_message", {
              senderId,
              groupId,
              message: {
                ...message,
                translatedText: message?.originalText || message?.text,
              },
            });
          } else {
            let translatedMsg = message;
            if (message?.groupTranslations) {
              const userTranslation = message.groupTranslations.find(
                (t) => String(t.userId) === String(memberId)
              );
              translatedMsg = {
                ...message,
                translatedText: userTranslation?.translatedText || message?.text,
              };
            }
            io.to(String(memberId)).emit("receiveMessage", { senderId, groupId, message: translatedMsg });
            io.to(String(memberId)).emit("receive_message", { senderId, groupId, message: translatedMsg });
          }
        }

        // Also emit to group room
        io.to(String(groupId)).emit("groupMessage", { senderId, groupId, message });
        io.to(String(groupId)).emit("group_message", { senderId, groupId, message });

        const hasFile = message?.fileUrl || message?.file;
        const hasLink = message?.text && /https?:\/\/\S+/i.test(message.text);
        if (message && (hasFile || hasLink)) {
          const payload = {
            _id: message._id,
            senderId: String(senderId),
            groupId: String(groupId),
            messageType: message.messageType || message.type || "text",
            fileUrl: message.fileUrl || message.file,
            fileName: message.fileName,
            fileSize: message.fileSize,
            text: message.text || "",
            createdAt: message.createdAt,
          };
          io.to(String(groupId)).emit("new_message", payload);
        }
        return;
      }

      // Handle 1-on-1 messages
      const blocked = await isBlocked(receiverId, senderId);
      if (blocked) return;

      const payload = { senderId, receiverId, message };
      // Deliver by room (reliable)
      io.to(String(receiverId)).emit("receiveMessage", payload);
      io.to(String(receiverId)).emit("receive_message", payload);

      // Echo to sender room for multi-tab sync (client should dedupe by _id)
      io.to(String(senderId)).emit("receiveMessage", payload);
      io.to(String(senderId)).emit("receive_message", payload);

      const hasFile = message?.fileUrl || message?.file;
      const hasLink = message?.text && /https?:\/\/\S+/i.test(message.text);
      if (message && (hasFile || hasLink)) {
        const mediaPayload = {
          _id: message._id,
          senderId: String(senderId),
          receiverId: String(receiverId),
          messageType: message.messageType || message.type || "text",
          fileUrl: message.fileUrl || message.file,
          fileName: message.fileName,
          fileSize: message.fileSize,
          text: message.text || "",
          createdAt: message.createdAt,
        };

        io.to(String(receiverId)).emit("new_message", mediaPayload);
        io.to(String(senderId)).emit("new_message", mediaPayload);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  };

  socket.on("joinGroup", async (groupId) => {
    try {
      socket.join(String(groupId));
      console.log(`User joined group: ${groupId}`);
    } catch (err) {
      console.error("joinGroup error:", err);
    }
  });

  socket.on("sendMessage", handleSendMessage);
  socket.on("send_message", handleSendMessage);

  socket.on("typing", async ({ senderId, receiverId }) => {
    try {
      if (await isBlocked(receiverId, senderId)) return;
      io.to(String(receiverId)).emit("userTyping", senderId);
      io.to(String(receiverId)).emit("typing", { senderId });
    } catch (err) {
      console.error("typing error:", err);
    }
  });

  socket.on("stopTyping", async ({ senderId, receiverId }) => {
    try {
      if (await isBlocked(receiverId, senderId)) return;
      io.to(String(receiverId)).emit("userStopTyping", senderId);
      io.to(String(receiverId)).emit("stop_typing", { senderId });
    } catch (err) {
      console.error("stopTyping error:", err);
    }
  });

  socket.on("stop_typing", ({ senderId, receiverId }) => {
    socket.emit("stopTyping", { senderId, receiverId });
  });

  socket.on("messageDelivered", async ({ senderId, receiverId, messageId }) => {
    try {
      if (!senderId || !receiverId) return;

      const now = new Date();
      if (messageId) {
        await Message.updateOne(
          {
            _id: new mongoose.Types.ObjectId(String(messageId)),
            sender: new mongoose.Types.ObjectId(senderId),
            receiver: new mongoose.Types.ObjectId(receiverId),
            status: "sent",
          },
          { $set: { status: "delivered", deliveredAt: now } }
        );
        io.to(String(senderId)).emit("message_status", {
          messageId: String(messageId),
          conversationId: String(receiverId),
          status: "delivered",
          deliveredAt: now.toISOString(),
        });
      } else {
        // Backwards compatibility: bulk update for legacy clients.
        await Message.updateMany(
          {
            sender: new mongoose.Types.ObjectId(senderId),
            receiver: new mongoose.Types.ObjectId(receiverId),
            status: "sent",
          },
          { $set: { status: "delivered", deliveredAt: now } }
        );
        // Legacy event (UI updates all messages in convo)
        io.to(String(senderId)).emit("updateStatus", {
          receiverId: String(receiverId),
          status: "delivered",
        });
      }
    } catch (err) {
      console.error("messageDelivered error:", err);
    }
  });

  socket.on("messageSeen", async ({ senderId, receiverId, messageIds }) => {
    try {
      if (!senderId || !receiverId) return;
      const now = new Date();

      if (Array.isArray(messageIds) && messageIds.length) {
        const ids = messageIds
          .map((id) => {
            try {
              return new mongoose.Types.ObjectId(String(id));
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (ids.length) {
          await Message.updateMany(
            {
              _id: { $in: ids },
              sender: new mongoose.Types.ObjectId(senderId),
              receiver: new mongoose.Types.ObjectId(receiverId),
              status: { $ne: "seen" },
            },
            { $set: { status: "seen", seenAt: now } }
          );
          io.to(String(senderId)).emit("message_status_batch", {
            messageIds: ids.map(String),
            conversationId: String(receiverId),
            status: "seen",
            seenAt: now.toISOString(),
          });
        }
      } else {
        // Backwards compatibility: bulk update
        await Message.updateMany(
          {
            sender: new mongoose.Types.ObjectId(senderId),
            receiver: new mongoose.Types.ObjectId(receiverId),
            status: { $ne: "seen" },
          },
          { $set: { status: "seen", seenAt: now } }
        );
        // Legacy event (UI updates all messages in convo)
        io.to(String(senderId)).emit("updateStatus", {
          receiverId: String(receiverId),
          status: "seen",
        });
      }
    } catch (err) {
      console.error("messageSeen error:", err);
    }
  });

  /* ---------- GROUP DELIVERY / READ RECEIPTS ---------- */
  const upsertReceipt = (receipts = [], userId, patch) => {
    const uid = String(userId);
    const next = Array.isArray(receipts) ? [...receipts] : [];
    const idx = next.findIndex((r) => String(r.userId) === uid);
    if (idx >= 0) next[idx] = { ...next[idx], ...patch, userId: next[idx].userId };
    else next.push({ userId: new mongoose.Types.ObjectId(uid), ...patch });
    return next;
  };

  const computeGroupRollupStatus = async (messageDoc) => {
    if (!messageDoc?.group) return null;
    const groupId = String(messageDoc.group);
    const senderId = String(messageDoc.sender);
    const group = await Group.findById(groupId).select("members.user isActive").lean();
    if (!group || !group.isActive) return null;
    const memberIds = (group.members || []).map((m) => String(m.user?._id || m.user));
    const others = memberIds.filter((id) => id && id !== senderId);
    if (!others.length) return null;

    const receiptMap = new Map(
      (messageDoc.groupReceipts || []).map((r) => [String(r.userId), r])
    );

    const allDelivered = others.every((id) => !!receiptMap.get(String(id))?.deliveredAt);
    const allSeen = others.every((id) => !!receiptMap.get(String(id))?.seenAt);

    if (allSeen) return "seen";
    if (allDelivered) return "delivered";
    return "sent";
  };

  socket.on("groupMessageDelivered", async ({ messageId, groupId }) => {
    try {
      const actorId = socket.data.userId || socket.data.authUserId;
      if (!actorId || !messageId || !groupId) return;

      const msg = await Message.findById(String(messageId)).lean();
      if (!msg || !msg.group || String(msg.group) !== String(groupId)) return;
      if (String(msg.sender) === String(actorId)) return; // sender doesn't ack themselves

      // Ensure actor is a member
      const group = await Group.findOne({
        _id: groupId,
        "members.user": actorId,
        isActive: true,
      }).select("_id").lean();
      if (!group) return;

      const now = new Date();

      // Update receipt + maybe rollup message.status
      const updated = await Message.findById(String(messageId)).select("group sender groupReceipts status").lean();
      if (!updated) return;

      const nextReceipts = upsertReceipt(updated.groupReceipts, actorId, {
        deliveredAt: updated.groupReceipts?.some((r) => String(r.userId) === String(actorId) && r.deliveredAt)
          ? updated.groupReceipts.find((r) => String(r.userId) === String(actorId)).deliveredAt
          : now,
      });

      const rollup = await computeGroupRollupStatus({
        ...updated,
        groupReceipts: nextReceipts,
      });

      await Message.updateOne(
        { _id: new mongoose.Types.ObjectId(String(messageId)) },
        {
          $set: {
            groupReceipts: nextReceipts,
            ...(rollup && rollup !== updated.status ? { status: rollup } : {}),
            ...(rollup === "delivered" && !updated.deliveredAt ? { deliveredAt: now } : {}),
          },
        }
      );

      // Notify sender (all their devices). conversationId = groupId.
      io.to(String(updated.sender)).emit("message_status", {
        messageId: String(messageId),
        conversationId: String(groupId),
        status: rollup || updated.status || "sent",
        deliveredAt: now.toISOString(),
      });
    } catch (err) {
      console.error("groupMessageDelivered error:", err);
    }
  });

  socket.on("groupMessageSeen", async ({ messageIds, groupId }) => {
    try {
      const actorId = socket.data.userId || socket.data.authUserId;
      if (!actorId || !groupId) return;
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;

      // Ensure actor is a member
      const group = await Group.findOne({
        _id: groupId,
        "members.user": actorId,
        isActive: true,
      }).select("_id").lean();
      if (!group) return;

      const now = new Date();
      const ids = messageIds
        .map((id) => {
          try {
            return new mongoose.Types.ObjectId(String(id));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      if (!ids.length) return;

      // Load messages (lean), update each receipt + rollup; batch updates.
      const docs = await Message.find({ _id: { $in: ids }, group: groupId })
        .select("_id group sender groupReceipts status deliveredAt")
        .lean();
      if (!docs.length) return;

      const bulk = [];
      const notificationsBySender = new Map(); // senderId -> {ids,status}

      for (const d of docs) {
        if (String(d.sender) === String(actorId)) continue;

        const nextReceipts = upsertReceipt(d.groupReceipts, actorId, {
          deliveredAt: (() => {
            const existing = (d.groupReceipts || []).find((r) => String(r.userId) === String(actorId));
            return existing?.deliveredAt || now;
          })(),
          seenAt: now,
        });

        const rollup = await computeGroupRollupStatus({
          ...d,
          groupReceipts: nextReceipts,
        });

        bulk.push({
          updateOne: {
            filter: { _id: d._id },
            update: {
              $set: {
                groupReceipts: nextReceipts,
                ...(rollup && rollup !== d.status ? { status: rollup } : {}),
                ...(rollup === "delivered" && !d.deliveredAt ? { deliveredAt: now } : {}),
                ...(rollup === "seen" ? { seenAt: now } : {}),
              },
            },
          },
        });

        const senderKey = String(d.sender);
        if (!notificationsBySender.has(senderKey)) notificationsBySender.set(senderKey, []);
        notificationsBySender.get(senderKey).push({ id: String(d._id), status: rollup || d.status || "sent" });
      }

      if (bulk.length) await Message.bulkWrite(bulk, { ordered: false });

      // Notify each sender (all devices). We send per-message status (small) in a batch per sender.
      for (const [senderId, items] of notificationsBySender.entries()) {
        if (!items.length) continue;
        // If all in this batch are seen, sender can blue-tick them; if mixed, client will apply per-message.
        io.to(String(senderId)).emit("message_status_batch", {
          messageIds: items.map((x) => x.id),
          conversationId: String(groupId),
          status: "seen",
          seenAt: now.toISOString(),
        });
      }
    } catch (err) {
      console.error("groupMessageSeen error:", err);
    }
  });

  /* ---------- CALL SIGNALING ---------- */
  const callTimeouts = app.get("callTimeouts") || new Map();
  app.set("callTimeouts", callTimeouts);

  socket.on("call_user", async ({ callerId, receiverId, callType, callerName, callId }) => {
    try {
      if (await isBlocked(receiverId, callerId)) {
        io.to(socket.id).emit("call_rejected", { message: "User has blocked you" });
        return;
      }

      const receiverRoom = onlineUsers[String(receiverId)];
      if (receiverRoom) {
        io.to(receiverRoom).emit("incoming_call", {
          callerId,
          receiverId,
          callType: callType || "audio",
          callerName: callerName || "Someone",
          callId,
        });
      } else {
        io.to(socket.id).emit("call_rejected", { message: "User is offline" });
        return;
      }

      // Auto-missed-call timer (15s) for unanswered calls
      const key = callId ? String(callId) : `${callerId}:${receiverId}`;
      if (callTimeouts.has(key)) {
        clearTimeout(callTimeouts.get(key));
      }
      const timeoutId = setTimeout(async () => {
        callTimeouts.delete(key);
        try {
          // Find most recent ongoing call between these users
          let call = null;
          if (callId) {
            call = await Call.findById(String(callId));
          }
          if (!call) {
            call = await Call.findOne({
              caller: callerId,
              receiver: receiverId,
            }).sort({ startedAt: -1 });
          }

          const now = new Date();
          if (call && call.status === "ongoing") {
            call.status = "missed";
            call.endedAt = now;
            call.duration = 0;
            await call.save();
          } else if (!call) {
            // Fallback: log missed call if nothing exists
            call = await Call.create({
              caller: callerId,
              receiver: receiverId,
              type: callType || "audio",
              status: "missed",
              direction: "outgoing",
              startedAt: now,
              endedAt: now,
              duration: 0,
            });
          }

          // Create missed call notification for receiver
          const notification = await Notification.create({
            userId: receiverId,
            type: "missed_call",
            isRead: false,
            metadata: {
              callerId,
              callType: callType || "audio",
            },
          });

          // Emit full notification object in real-time for panels & badges
          // Only emit notification_created to avoid duplicate processing
          io.to(String(receiverId)).emit("notification_created", notification);

          const finalCallId = call ? String(call._id) : callId ? String(callId) : undefined;

          // Notify both parties that the call timed out so UIs can close without refresh
          if (finalCallId) {
            io.to(String(callerId)).emit("call_timeout", {
              callId: finalCallId,
              status: "missed",
            });
            io.to(String(receiverId)).emit("call_timeout", {
              callId: finalCallId,
              status: "missed",
            });
          } else {
            io.to(String(callerId)).emit("call_timeout", {
              status: "missed",
            });
            io.to(String(receiverId)).emit("call_timeout", {
              status: "missed",
            });
          }

          // Backwards compatible missed-call event for call notification badges
          io.to(String(receiverId)).emit("missed_call", {
            callerId,
            callerName: callerName || "Someone",
            callType: callType || "audio",
          });
        } catch (err) {
          console.error("Auto-missed-call timer error:", err);
        }
      }, 15_000);
      callTimeouts.set(key, timeoutId);
    } catch (err) {
      console.error("call_user error:", err);
    }
  });

  socket.on("accept_call", ({ callerId, receiverId, callId }) => {
    const key = callId ? String(callId) : `${callerId}:${receiverId}`;
    const callTimeouts = app.get("callTimeouts");
    if (callTimeouts && callTimeouts.has(key)) {
      clearTimeout(callTimeouts.get(key));
      callTimeouts.delete(key);
    }
    const callerRoom = onlineUsers[String(callerId)];
    if (callerRoom) io.to(callerRoom).emit("call_accepted", { receiverId });
  });

  socket.on("reject_call", ({ callerId, receiverId, callId }) => {
    const key = callId ? String(callId) : `${callerId}:${receiverId}`;
    const callTimeouts = app.get("callTimeouts");
    if (callTimeouts && callTimeouts.has(key)) {
      clearTimeout(callTimeouts.get(key));
      callTimeouts.delete(key);
    }
    const callerRoom = onlineUsers[String(callerId)];
    if (callerRoom) io.to(callerRoom).emit("call_rejected", { receiverId });
  });

  socket.on("offer", ({ to, from, offer }) => {
    const toRoom = onlineUsers[String(to)];
    if (toRoom) io.to(toRoom).emit("offer", { from, offer });
  });

  socket.on("answer", ({ to, from, answer }) => {
    const toRoom = onlineUsers[String(to)];
    if (toRoom) io.to(toRoom).emit("answer", { from, answer });
  });

  socket.on("ice_candidate", ({ to, from, candidate }) => {
    const toRoom = onlineUsers[String(to)];
    if (toRoom) io.to(toRoom).emit("ice_candidate", { from, candidate });
  });

  socket.on("end_call", ({ to, from, callId }) => {
    const key = callId ? String(callId) : `${from}:${to}`;
    const callTimeouts = app.get("callTimeouts");
    if (callTimeouts && callTimeouts.has(key)) {
      clearTimeout(callTimeouts.get(key));
      callTimeouts.delete(key);
    }
    const toRoom = onlineUsers[String(to)];
    if (toRoom) io.to(toRoom).emit("call_ended", { from });
  });

  socket.on("disconnect", () => {
    const uid = socket.data.userId ? String(socket.data.userId) : null;
    const did = socket.data.deviceId ? String(socket.data.deviceId) : null;

    if (uid) {
      const set = userSockets.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(uid);
      }

      if (did) {
        const deviceMap = userDeviceSockets.get(uid);
        if (deviceMap) {
          const current = deviceMap.get(did);
          if (current === socket.id) deviceMap.delete(did);
          if (deviceMap.size === 0) userDeviceSockets.delete(uid);
        }
      }

      // Only mark offline when the user has no remaining sockets
      const remaining = userSockets.get(uid);
      if (!remaining || remaining.size === 0) {
        delete onlineUsers[uid];
        app.set("onlineUsers", onlineUsers);
        handleUserOffline(uid, io, onlineUsers);
      }
    }

    const list = getOnlineList();
    io.emit("onlineUsers", list);
    io.emit("online_users", list);

    console.log("User disconnected:", socket.id);
  });
});

/* ---------------- FIXED DB + SERVER START ---------------- */

const PORT = process.env.PORT || 5990;
const HOST = process.env.HOST || "0.0.0.0";

async function startServer() {
  try {
    mongoose.set("bufferCommands", false);

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Atlas connected");

    // Ensure default admin user exists (for initial login)
    try {
      const adminEmail =
        process.env.ADMIN_EMAIL || "admin@example.com";
      const adminUsername =
        process.env.ADMIN_USERNAME || "admin";
      const adminPassword =
        process.env.ADMIN_PASSWORD || "Admin@1234";

      const usersToEnsure = [
        {
          email: adminEmail,
          username: adminUsername,
          password: adminPassword,
          role: "admin",
        },
      ];

      for (const u of usersToEnsure) {
        const existing = await User.findOne({ email: u.email });
        if (!existing) {
          const hashed = await bcrypt.hash(u.password, 10);
          await User.create({
            username: u.username,
            email: u.email,
            password: hashed,
            role: u.role,
          });
          console.log(
            `Default ${u.role} created. Email: ${u.email}, Username: ${u.username}`
          );
        }
      }
    } catch (seedErr) {
      console.error("Failed to ensure default admin users:", seedErr);
    }

httpServer.listen(PORT, HOST, () => {
        console.log(`Server running on ${HOST}:${PORT}`);

      const interfaces = os.networkInterfaces();

      console.log(`Local:   http://localhost:${PORT}`);

      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
          if (net.family === "IPv4" && !net.internal) {
            console.log(`Network: http://${net.address}:${PORT}`);
          }
        }
      }
      // Start cron jobs
      let scheduledTickInFlight = false;
      setInterval(async () => {
        if (scheduledTickInFlight) return;
        scheduledTickInFlight = true;
        try {
          await processScheduledMessages(io);
        } finally {
          scheduledTickInFlight = false;
        }
      }, 1000);
      setInterval(async () => {
        await processSelfDestructingGroups();
      }, 60 * 1000);
      console.log(
        "Cron jobs started for scheduled messages and self-destructing groups"
      );
    });

  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

startServer();
