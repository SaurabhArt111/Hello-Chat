import FriendRequest from "../models/FriendRequest.js";
import Notification from "../models/Notification.js";
import Friend from "../models/Friend.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import ProfilePhotoPrivacy from "../models/ProfilePhotoPrivacy.js";
import BlockedUser from "../models/BlockedUser.js";
import mongoose from "mongoose";

/* SEND FRIEND REQUEST */
export const sendRequest = async (req, res) => {
  try {
    const senderId = req.user; // from JWT middleware (ObjectId)
    const { receiverId } = req.body;

    const senderStr = String(senderId);
    const receiverStr = String(receiverId);

    // ❌ cannot send to self
    if (senderStr === receiverStr) {
      return res
        .status(400)
        .json({ message: "Cannot send request to yourself" });
    }

    // ❌ check existing request
    const existing = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existing) {
      return res.status(400).json({ message: "Request already sent" });
    }

    // ❌ check reverse request (receiver already sent to sender)
    const reverse = await FriendRequest.findOne({
      sender: receiverId,
      receiver: senderId,
      status: { $in: ["pending", "accepted"] },
    });

    if (reverse) {
      return res.status(400).json({
        message: "User already sent you a request",
      });
    }

    // ✅ create request
    const request = await FriendRequest.create({
      sender: senderId,
      receiver: receiverId,
    });

    // Create a notification document for the receiver
    const notification = await Notification.create({
      userId: receiverId,
      type: "friend_request",
      isRead: false,
    });

    // Emit real-time event to the receiver via Socket.io
    try {
      const io = req.app.get("io");
      if (io) {
        const senderUser = await User.findById(senderId).select(
          "username avatar"
        );

        io.to(String(receiverId)).emit("friend_request_received", {
          notificationId: notification._id,
          senderId,
          senderName: senderUser?.username,
          senderAvatar: senderUser?.avatar,
          createdAt: notification.createdAt,
        });
      }
    } catch (socketErr) {
      console.error("Error emitting friend_request_received:", socketErr);
    }

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ACCEPT FRIEND REQUEST */
export const acceptRequest = async (req, res) => {
  try {
    const userId = req.user; // logged-in user (ObjectId)
    const requestId = req.params.requestId || req.body.requestId;

    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Valid requestId is required" });
    }

    const request = await FriendRequest.findById(requestId);

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    // Only receiver can accept
    if (request.receiver.toString() !== String(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (request.status === "accepted") {
      return res.json({ message: "Already accepted", request });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: `Cannot accept a ${request.status} request` });
    }

    request.status = "accepted";
    await request.save();

    const senderId = String(request.sender);
    const receiverId = String(request.receiver);

    // Create or ensure Friend entry
    const [a, b] = [senderId, receiverId].sort();
    await Friend.updateOne(
      { user1: a, user2: b },
      { $setOnInsert: { user1: a, user2: b } },
      { upsert: true }
    );

    // Create or ensure Conversation (1-1 chat)
    try {
      await Conversation.updateOne(
        { participants: { $all: [senderId, receiverId], $size: 2 } },
        { $setOnInsert: { participants: [senderId, receiverId] } },
        { upsert: true }
      );
    } catch (convErr) {
      console.error("CONVERSATION UPSERT ERROR:", convErr);
    }

    // Emit real-time events
    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          requestId: request._id,
          senderId,
          receiverId,
        };
        io.to(String(senderId)).emit("request_accepted", payload);
        io.to(String(receiverId)).emit("request_accepted", payload);

        // Create notification for sender (their request was accepted)
        try {
          const notification = await Notification.create({
            userId: senderId,
            type: "friend_request_accepted",
            isRead: false,
            metadata: {
              accepterId: receiverId,
            },
          });
          io.to(String(senderId)).emit("notification_update", {
            notification,
          });
        } catch (notifErr) {
          console.error("Error creating/emitting friend_request_accepted notification:", notifErr);
        }
      }
    } catch (socketErr) {
      console.error("Error emitting request_accepted:", socketErr);
    }

    res.json({ message: "Friend request accepted", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* REJECT FRIEND REQUEST */
export const rejectRequest = async (req, res) => {
  try {
    const userId = req.user; // logged-in user (ObjectId)
    const requestId = req.params.requestId || req.body.requestId;

    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Valid requestId is required" });
    }

    const request = await FriendRequest.findById(requestId);

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    // Only receiver can reject
    if (request.receiver.toString() !== String(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (request.status === "rejected") {
      return res.json({ message: "Already rejected", request });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: `Cannot reject a ${request.status} request` });
    }

    request.status = "rejected";
    await request.save();

    const senderId = String(request.sender);
    const receiverId = String(request.receiver);

    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          requestId: request._id,
          senderId,
          receiverId,
        };
        io.to(String(senderId)).emit("request_rejected", payload);
        io.to(String(receiverId)).emit("request_rejected", payload);

        // Create notification for sender (their request was rejected)
        try {
          const notification = await Notification.create({
            userId: senderId,
            type: "friend_request_rejected",
            isRead: false,
            metadata: {
              rejecterId: receiverId,
            },
          });
          io.to(String(senderId)).emit("notification_update", {
            notification,
          });
        } catch (notifErr) {
          console.error("Error creating/emitting friend_request_rejected notification:", notifErr);
        }
      }
    } catch (socketErr) {
      console.error("Error emitting request_rejected:", socketErr);
    }

    res.json({ message: "Friend request rejected", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* CANCEL FRIEND REQUEST */
export const cancelRequest = async (req, res) => {
  try {
    const userId = req.user; // logged-in user (ObjectId)
    const requestId = req.params.requestId || req.body.requestId;

    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Valid requestId is required" });
    }

    const request = await FriendRequest.findById(requestId);

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    // Only sender can cancel
    if (request.sender.toString() !== String(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: `Cannot cancel a ${request.status} request` });
    }

    request.status = "cancelled";
    await request.save();

    const senderId = String(request.sender);
    const receiverId = String(request.receiver);

    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          requestId: request._id,
          senderId,
          receiverId,
        };
        io.to(String(senderId)).emit("request_cancelled", payload);
        io.to(String(receiverId)).emit("request_cancelled", payload);
      }
    } catch (socketErr) {
      console.error("Error emitting request_cancelled:", socketErr);
    }

    res.json({ message: "Friend request cancelled", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* GET INCOMING REQUESTS (NOTIFICATIONS) */
export const getIncomingRequests = async (req, res) => {
  try {
    const userId = req.user;

    const requests = await FriendRequest.find({
      receiver: userId,
      status: "pending",
    })
      .populate("sender", "username email avatar")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* GET FRIENDS LIST */
export const getFriendsList = async (req, res) => {
  try {
    const userId = req.user;

    const friendships = await Friend.find({
      $or: [{ user1: userId }, { user2: userId }],
    })
      .populate("user1", "username avatar email")
      .populate("user2", "username avatar email");

    // Extract the OTHER person from each relation
    const rawFriends = friendships.map((f) =>
      String(f.user1._id || f.user1) === String(userId) ? f.user2 : f.user1
    );

    // Apply profile photo privacy (everyone / contacts / nobody)
    const friendIds = rawFriends.map((u) => u._id);
    const settings = await ProfilePhotoPrivacy.find({
      userId: { $in: friendIds },
    }).lean();

    const settingMap = new Map(
      settings.map((s) => [String(s.userId), s.profilePhoto])
    );

    const friends = rawFriends.map((u) => {
      const obj = u.toObject ? u.toObject() : u;
      const rule = settingMap.get(String(obj._id)) || "everyone";

      // For friends, "contacts" and "everyone" allow real avatar
      if (rule === "nobody") {
        return { ...obj, avatar: "/default-avatar.png" };
      }
      return obj;
    });

    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* GET ALL USERS YOU CAN SEND REQUEST TO */
export const getAllUsers = async (req, res) => {
  try {
    const userId = req.user;

    // Collect all related user IDs from Friend documents
    const relations = await Friend.find({
      $or: [{ user1: userId }, { user2: userId }],
    });

    const excludedIds = new Set([String(userId)]);
    relations.forEach((r) => {
      excludedIds.add(String(r.user1));
      excludedIds.add(String(r.user2));
    });

    // Fetch users not in excluded list
    const users = await User.find({
      _id: { $nin: Array.from(excludedIds) }
    }).select("username email avatar bio");

    // Apply profile photo privacy: viewer is NOT in contacts of these users
    const userIds = users.map((u) => u._id);
    const settings = await ProfilePhotoPrivacy.find({
      userId: { $in: userIds },
    }).lean();
    const settingMap = new Map(
      settings.map((s) => [String(s.userId), s.profilePhoto])
    );

    const sanitized = users.map((u) => {
      const obj = u.toObject ? u.toObject() : u;
      const rule = settingMap.get(String(obj._id)) || "everyone";

      // Non-contacts: only "everyone" shows avatar; others default
      if (rule === "everyone") return obj;
      return { ...obj, avatar: "/default-avatar.png" };
    });

    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* BLOCK FROM REQUEST (receiver blocks sender + cancels request) */
export const blockFromRequest = async (req, res) => {
  try {
    const authId = req.user;
    const requestId = req.params.requestId || req.body.requestId;

    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Valid requestId is required" });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (String(request.receiver) !== String(authId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const senderId = String(request.sender);

    // Block sender
    await BlockedUser.updateOne(
      { blockerId: authId, blockedUserId: senderId },
      { $setOnInsert: { blockerId: authId, blockedUserId: senderId } },
      { upsert: true }
    );

    // Mark request as cancelled
    if (request.status === "pending") {
      request.status = "cancelled";
      await request.save();
    }

    // Emit cancellation + optional block event
    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          requestId: request._id,
          senderId,
          receiverId: String(authId),
        };
        io.to(String(senderId)).emit("request_cancelled", payload);
        io.to(String(authId)).emit("request_cancelled", payload);
        io.to(String(senderId)).emit("user_blocked", {
          blockerId: String(authId),
          blockedUserId: senderId,
        });
      }
    } catch (socketErr) {
      console.error("Error emitting blockFromRequest events:", socketErr);
    }

    return res.json({ message: "User blocked and request cancelled" });
  } catch (err) {
    console.error("BLOCK FROM REQUEST ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* UNDO REJECT within a short time window */
export const undoReject = async (req, res) => {
  try {
    const userId = req.user;
    const requestId = req.params.requestId || req.body.requestId;

    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Valid requestId is required" });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (String(request.receiver) !== String(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (request.status !== "rejected") {
      return res.status(400).json({ message: "Only rejected requests can be undone" });
    }

    const updatedAt = request.updatedAt || request.createdAt;
    const diffMs = Date.now() - new Date(updatedAt).getTime();
    if (diffMs > 10 * 1000) {
      return res.status(400).json({ message: "Undo window expired" });
    }

    request.status = "pending";
    await request.save();

    try {
      const io = req.app.get("io");
      if (io) {
        const payload = {
          requestId: request._id,
          senderId: String(request.sender),
          receiverId: String(request.receiver),
        };
        io.to(String(request.sender)).emit("request_restored", payload);
        io.to(String(request.receiver)).emit("request_restored", payload);
      }
    } catch (socketErr) {
      console.error("Error emitting request_restored:", socketErr);
    }

    return res.json({ message: "Request restored to pending", request });
  } catch (err) {
    console.error("UNDO REJECT ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};