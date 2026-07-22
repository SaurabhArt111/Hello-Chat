import mongoose from "mongoose";
import Call from "../models/Call.js";
import FriendRequest from "../models/FriendRequest.js";
import { isBlocked } from "./blockController.js";

/* GET CALL HISTORY */
export const getCallHistory = async (req, res) => {
  try {
    const userId = req.user; // authMiddleware sets req.user to the ID string

    // Get all calls where user is either caller or receiver
    const calls = await Call.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate("caller", "username avatar")
      .populate("receiver", "username avatar")
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    // Format calls to include contact info and per-user direction
    const formattedCalls = calls.map((call) => {
      const isCaller = String(call.caller._id) === String(userId);
      const contact = isCaller ? call.receiver : call.caller;
      const contactName = contact?.username || "Unknown";

      return {
        ...call,
        contact,
        contactName,
        contactId: contact?._id,
        direction: isCaller ? "outgoing" : "incoming",
      };
    });

    return res.json({ data: formattedCalls });
  } catch (err) {
    console.error("GET CALL HISTORY ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* START CALL */
export const startCall = async (req, res) => {
  try {
    const { userId, type = "audio" } = req.body;
    const callerId = req.user; // authMiddleware sets req.user to the ID string

    // Validate input
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Check if users are friends
    const friendship = await FriendRequest.findOne({
      $or: [
        { sender: callerId, receiver: userId },
        { sender: userId, receiver: callerId },
      ],
      status: "accepted",
    }).lean();

    if (!friendship) {
      return res.status(403).json({ message: "You can only call friends" });
    }

    if (await isBlocked(userId, callerId)) {
      return res.status(403).json({ message: "You cannot call this user" });
    }

    // Create call record
    const call = new Call({
      caller: callerId,
      receiver: userId,
      type,
      direction: "outgoing",
      status: "ongoing",
      startedAt: new Date(),
    });

    await call.save();

    // Populate and return
    await call.populate("caller", "username avatar");
    await call.populate("receiver", "username avatar");

    return res.json({
      message: "Call started",
      data: call,
    });
  } catch (err) {
    console.error("START CALL ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* END CALL */
export const endCall = async (req, res) => {
  try {
    const { callId, duration = 0, status: bodyStatus } = req.body;
    const userId = req.user; // authMiddleware sets req.user to the ID string

    if (!callId) {
      return res.status(400).json({ message: "Call ID is required" });
    }

    // Find call and verify user is part of it
    const call = await Call.findOne({
      _id: callId,
      $or: [{ caller: userId }, { receiver: userId }],
    });

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    // Status: use body if valid, else answered if duration > 0 else missed
    const status =
      bodyStatus && ["missed", "answered", "rejected"].includes(bodyStatus)
        ? bodyStatus
        : duration > 0
          ? "answered"
          : "missed";

    call.status = status;
    call.duration = duration;
    call.endedAt = new Date();

    await call.save();

    return res.json({
      message: "Call ended",
      data: call,
    });
  } catch (err) {
    console.error("END CALL ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};
