import User from "../models/User.js";
import Message from "../models/Message.js";
import Report from "../models/Report.js";
import AuditLog from "../models/AuditLog.js";
import { createAuditLog } from "../utils/createAuditLog.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const calcChange = (current, previous) => {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now - SEVEN_DAYS_MS);
    const fourteenDaysAgo = new Date(now - 2 * SEVEN_DAYS_MS);

    const [
      totalUsers,
      totalMessages,
      bannedUsers,
      activeUsers24h,
      openReports,
      usersSevenDaysAgo,
      messagesLast7Days,
      messagesPrev7Days,
    ] = await Promise.all([
      User.countDocuments({}),
      Message.countDocuments({}),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({
        lastSeen: { $gte: new Date(now - ONE_DAY_MS) },
      }),
      Report.countDocuments({ status: "open" }),
      User.countDocuments({ createdAt: { $lt: sevenDaysAgo } }),
      Message.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Message.countDocuments({
        createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
      }),
    ]);

    const usersChange = calcChange(totalUsers, usersSevenDaysAgo);
    const messagesChange = calcChange(messagesLast7Days, messagesPrev7Days);
    const bannedChange = 0;
    const activeChange = 0;
    const reportsChange = 0;

    return res.json({
      totalUsers,
      totalMessages,
      bannedUsers,
      activeUsers24h,
      openReports,
      changes: {
        totalUsers: usersChange,
        totalMessages: messagesChange,
        bannedUsers: bannedChange,
        activeUsers24h: activeChange,
        openReports: reportsChange,
      },
    });
  } catch (err) {
    console.error("ADMIN DASHBOARD ERROR:", err);
    return res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};

export const getDashboardCharts = async (req, res) => {
  try {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    const userGrowth = await Promise.all(
      days.map(async (day) => {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const count = await User.countDocuments({
          createdAt: { $gte: day, $lt: next },
        });
        return {
          date: day.toISOString().slice(0, 10),
          label: day.toLocaleDateString("en-US", { weekday: "short" }),
          count,
        };
      })
    );

    const messagesPerDay = await Promise.all(
      days.map(async (day) => {
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const count = await Message.countDocuments({
          createdAt: { $gte: day, $lt: next },
        });
        return {
          date: day.toISOString().slice(0, 10),
          label: day.toLocaleDateString("en-US", { weekday: "short" }),
          count,
        };
      })
    );

    return res.json({ userGrowth, messagesPerDay });
  } catch (err) {
    console.error("ADMIN DASHBOARD CHARTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load charts" });
  }
};

export const getActivityFeed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "20", 10);

    const [recentUsers, auditLogs, recentReports] = await Promise.all([
      User.find({})
        .select("username createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AuditLog.find({})
        .populate("adminId", "username")
        .populate("targetUserId", "username")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Report.find({ status: "open" })
        .populate("reporterId", "username")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const activities = [];

    recentUsers.forEach((u) => {
      activities.push({
        type: "registration",
        username: u.username,
        createdAt: u.createdAt,
      });
    });

    auditLogs.forEach((log) => {
      activities.push({
        type: "admin_action",
        actionType: log.actionType,
        adminUsername: log.adminId?.username,
        targetUsername: log.targetUserId?.username,
        createdAt: log.createdAt,
      });
    });

    recentReports.forEach((r) => {
      activities.push({
        type: "report",
        reporterUsername: r.reporterId?.username,
        reason: r.reason?.slice(0, 50),
        createdAt: r.createdAt,
      });
    });

    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const feed = activities.slice(0, limit);

    return res.json({ activities: feed });
  } catch (err) {
    console.error("ADMIN ACTIVITY FEED ERROR:", err);
    return res.status(500).json({ message: "Failed to load activity feed" });
  }
};

export const getTopActiveUsers = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const top = await Message.aggregate([
      { $match: { sender: { $exists: true, $ne: null } } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          username: "$user.username",
          email: "$user.email",
          messageCount: "$count",
        },
      },
    ]);

    return res.json({ users: top });
  } catch (err) {
    console.error("ADMIN TOP USERS ERROR:", err);
    return res.status(500).json({ message: "Failed to load top users" });
  }
};

export const getSystemHealth = async (req, res) => {
  try {
    const start = Date.now();
    await User.findOne().select("_id").limit(1).lean();
    const dbLatency = Date.now() - start;

    const activeSessions = await User.countDocuments({
      lastSeen: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    return res.json({
      api: "healthy",
      database: dbLatency < 500 ? "healthy" : "degraded",
      databaseLatencyMs: dbLatency,
      uptimeSeconds: Math.floor(process.uptime()),
      activeSessions,
    });
  } catch (err) {
    console.error("ADMIN SYSTEM HEALTH ERROR:", err);
    return res.json({
      api: "healthy",
      database: "unhealthy",
      databaseLatencyMs: null,
      uptimeSeconds: Math.floor(process.uptime()),
      activeSessions: 0,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("username email role bio avatar isOnline lastSeen createdAt isBanned")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const [totalMessages, reportsResult] = await Promise.all([
      Message.countDocuments({ sender: user._id }),
      Report.aggregate([
        { $lookup: { from: "messages", localField: "messageId", foreignField: "_id", as: "msg" } },
        { $unwind: "$msg" },
        { $match: { "msg.sender": user._id } },
        { $count: "count" },
      ]),
    ]);

    const reportsCount = reportsResult[0]?.count ?? 0;

    return res.json({
      ...user,
      totalMessages,
      reportsCount,
    });
  } catch (err) {
    console.error("ADMIN GET USER ERROR:", err);
    return res.status(500).json({ message: "Failed to load user" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      100
    );
    const search = (req.query.search || "").trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const role = req.query.role?.trim();
    if (role) filter.role = role;
    const status = req.query.status?.trim();
    if (status === "banned") filter.isBanned = true;
    else if (status === "active") filter.isBanned = { $ne: true };

    const sortBy = req.query.sort || "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("username email role isOnline lastSeen createdAt isBanned avatar bio")
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      users: items,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("ADMIN GET USERS ERROR:", err);
    return res.status(500).json({ message: "Failed to load users" });
  }
};

export const banUser = async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (String(targetId) === String(req.user)) {
      return res.status(400).json({ message: "Cannot ban yourself" });
    }

    const user = await User.findByIdAndUpdate(
      targetId,
      { isBanned: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    await createAuditLog({
      adminId: req.user,
      actionType: "BAN_USER",
      targetUserId: user._id,
      req,
    });

    return res.json({ message: "User banned", user });
  } catch (err) {
    console.error("BAN USER ERROR:", err);
    return res.status(500).json({ message: "Failed to ban user" });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const targetId = req.params.userId;
    const user = await User.findByIdAndUpdate(
      targetId,
      { isBanned: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    await createAuditLog({
      adminId: req.user,
      actionType: "UNBAN_USER",
      targetUserId: user._id,
      req,
    });

    return res.json({ message: "User unbanned", user });
  } catch (err) {
    console.error("UNBAN USER ERROR:", err);
    return res.status(500).json({ message: "Failed to unban user" });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const targetId = req.params.userId;
    const user = await User.findByIdAndUpdate(
      targetId,
      { isOnline: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    await createAuditLog({
      adminId: req.user,
      actionType: "DEACTIVATE_USER",
      targetUserId: user._id,
      req,
    });

    return res.json({ message: "User deactivated", user });
  } catch (err) {
    console.error("DEACTIVATE USER ERROR:", err);
    return res.status(500).json({ message: "Failed to deactivate user" });
  }
};

export const forceLogoutUser = async (req, res) => {
  try {
    const targetId = req.params.userId;
    const user = await User.findByIdAndUpdate(
      targetId,
      { $inc: { jwtVersion: 1 } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    await createAuditLog({
      adminId: req.user,
      actionType: "FORCE_LOGOUT",
      targetUserId: user._id,
      req,
    });

    return res.json({ message: "User sessions invalidated" });
  } catch (err) {
    console.error("FORCE LOGOUT ERROR:", err);
    return res.status(500).json({ message: "Failed to force logout user" });
  }
};

