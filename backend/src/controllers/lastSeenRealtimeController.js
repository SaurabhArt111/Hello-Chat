import mongoose from "mongoose";
import User from "../models/User.js";
import LastSeenSetting from "../models/LastSeenSetting.js";
import FriendRequest from "../models/FriendRequest.js";
import BlockedUser from "../models/BlockedUser.js";

const getVisibility = async (userId) => {
  const setting = await LastSeenSetting.findOne({ userId }).lean();
  return setting?.lastSeen || "everyone";
};

const getContacts = async (userId) => {
  const friendships = await FriendRequest.find({
    status: "accepted",
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .select("sender receiver")
    .lean();

  const contacts = new Set();
  friendships.forEach((f) => {
    contacts.add(String(f.sender));
    contacts.add(String(f.receiver));
  });
  contacts.delete(String(userId));
  return Array.from(contacts);
};

export const handleUserOnline = async (userId, io, onlineUsers = {}) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      online: true,
    });

    const blocked = await BlockedUser.find({ blockerId: userId })
      .select("blockedUserId")
      .lean();
    const blockedSet = new Set(blocked.map((b) => String(b.blockedUserId)));

    for (const [uid, socketId] of Object.entries(onlineUsers)) {
      if (uid !== userId && !blockedSet.has(uid)) {
        io.to(socketId).emit("user_online", { userId });
      }
    }
  } catch (err) {
    console.error("handleUserOnline error:", err);
  }
};

export const handleUserOffline = async (userId, io, onlineUsers = {}) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;

    const now = new Date();
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isOnline: false,
        online: false,
        lastSeen: now,
      },
      { new: true }
    ).lean();

    if (!user) return;

    const blocked = await BlockedUser.find({ blockerId: userId })
      .select("blockedUserId")
      .lean();
    const blockedSet = new Set(blocked.map((b) => String(b.blockedUserId)));

    for (const [uid, socketId] of Object.entries(onlineUsers)) {
      if (uid !== userId && !blockedSet.has(uid)) {
        io.to(socketId).emit("user_offline", { userId, lastSeen: user.lastSeen });
      }
    }

    const visibility = await getVisibility(userId);
    if (visibility === "nobody") return;

    const payload = { userId, lastSeen: user.lastSeen };

    if (visibility === "everyone") {
      for (const [uid, socketId] of Object.entries(onlineUsers)) {
        if (uid !== userId && !blockedSet.has(uid)) {
          io.to(socketId).emit("last_seen_update", payload);
        }
      }
    } else if (visibility === "contacts") {
      const contacts = await getContacts(userId);
      const filtered = contacts.filter((cid) => !blockedSet.has(String(cid)));
      filtered.forEach((cid) => {
        const socketId = onlineUsers[cid];
        if (socketId) io.to(socketId).emit("last_seen_update", payload);
      });
    }
  } catch (err) {
    console.error("handleUserOffline error:", err);
  }
};

