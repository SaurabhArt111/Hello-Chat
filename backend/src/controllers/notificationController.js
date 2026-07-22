import mongoose from "mongoose";
import NotificationSetting from "../models/NotificationSetting.js";
import Notification from "../models/Notification.js";

const ensureOwner = (authUserId, targetUserId) => {
  return String(authUserId) === String(targetUserId);
};

// Combined GET:
// - returns notification setting (enabled/disabled)
// - returns list of notifications + unread count
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let setting = await NotificationSetting.findOne({ userId }).lean();

    if (!setting) {
      // create default if not found
      setting = await NotificationSetting.create({
        userId,
        notifications: true,
      });
      setting = setting.toObject();
    }

    const items = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const unreadCount = items.filter((n) => !n.isRead).length;

    return res.json({
      userId: String(setting.userId),
      notificationsEnabled: setting.notifications,
      notifications: setting.notifications, // backwards compatibility for existing toggle
      unreadCount,
      items,
    });
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Update the on/off setting only
export const updateNotificationSetting = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notifications } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!ensureOwner(req.user, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (typeof notifications !== "boolean") {
      return res.status(400).json({ message: "notifications must be a boolean" });
    }

    const updated = await NotificationSetting.findOneAndUpdate(
      { userId },
      { userId, notifications },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      userId: String(updated.userId),
      notifications: updated.notifications,
    });
  } catch (err) {
    console.error("UPDATE NOTIFICATION SETTING ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/notifications/read/:id
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Ensure the authenticated user owns this notification
    if (!ensureOwner(req.user, notification.userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({
      id: String(notification._id),
      isRead: notification.isRead,
    });
  } catch (err) {
    console.error("MARK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

