import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import socket from "../socket";
import axios from "../api/axios";
import { Toaster, toast } from "react-hot-toast";
import { requestNotificationPermission, showBackgroundNotification } from "../utils/browserNotifications";

const NotificationContext = createContext(null);

export const useNotificationContext = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  }
  return ctx;
};

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const processedNotificationIdsRef = React.useRef(new Set());

  // Initial load: fetch setting + existing notifications
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const userId = storedUser?.id || storedUser?._id;
    if (!userId) return;

    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`/notifications/${userId}`);
        const enabled =
          res.data.notificationsEnabled ?? res.data.notifications ?? true;
        setNotificationsEnabled(enabled);

        const items = res.data.items || [];
        const unread =
          typeof res.data.unreadCount === "number"
            ? res.data.unreadCount
            : items.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
        setNotifications(items);
        // Populate processed IDs to prevent re-processing existing notifications via socket
        items.forEach((n) => {
          if (n._id) processedNotificationIdsRef.current.add(String(n._id));
        });
      } catch (err) {
        console.error("Failed to load notifications", err);
      }
    };

    fetchNotifications();

    // Ask for OS/browser notification permission once a user is logged in.
    // Without this, `Notification.permission` stays "default" forever and
    // every downstream notification (calls, messages) silently no-ops -
    // this was previously never requested anywhere in the app.
    requestNotificationPermission();
  }, []);

  // Socket listener for real-time friend requests
  useEffect(() => {
    const handler = (data) => {
      if (!notificationsEnabled) return;

      setUnreadCount((prev) => prev + 1);

      const name = data?.senderName || "Someone";
      toast.success(`New friend request from ${name}`);
    };

    socket.on("friend_request_received", handler);

    return () => {
      socket.off("friend_request_received", handler);
    };
  }, [notificationsEnabled]);

  // Generic notification updates (missed calls, friend accept/reject, etc.)
  useEffect(() => {
    const handler = (payload) => {
      if (!notificationsEnabled) return;

      const notification = payload?.notification || payload;
      if (!notification || !notification._id) return;

      const notificationId = String(notification._id);

      // Prevent duplicate processing (same notification ID)
      if (processedNotificationIdsRef.current.has(notificationId)) {
        return;
      }
      processedNotificationIdsRef.current.add(notificationId);

      // Only increment badge if notification is unread
      if (notification.isRead === false || notification.isRead == null) {
        setUnreadCount((prev) => prev + 1);
      }

      // Add to notifications list (deduplication already handled above)
      setNotifications((prev) => {
        if (prev.some((n) => String(n._id) === notificationId)) {
          return prev;
        }
        return [notification, ...prev];
      });

      const type = notification.type;
      const meta = notification.metadata || {};

      // Don't show toast for missed_call - CallNotificationContext handles it
      if (type === "friend_request_accepted") {
        toast.success("Your friend request was accepted");
      } else if (type === "friend_request_rejected") {
        toast("Your friend request was rejected");
      }
    };

    // Only listen to notification_created (primary event) to avoid duplicates
    socket.on("notification_created", handler);
    return () => {
      socket.off("notification_created", handler);
    };
  }, [notificationsEnabled]);

  // Background OS notification for incoming chat messages. This is
  // separate from the message-rendering logic in Home.jsx (which stays
  // untouched) - purely fires a notification when the tab isn't focused,
  // for both 1:1 and group messages.
  useEffect(() => {
    if (!notificationsEnabled) return undefined;

    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const myUserId = storedUser?.id || storedUser?._id;

    const notifyIncoming = (data) => {
      const senderId = data?.senderId || data?.message?.sender;
      if (!senderId || String(senderId) === String(myUserId)) return; // ignore my own messages

      const senderName = data?.senderName || data?.message?.senderName || "New message";
      const preview =
        data?.text ||
        data?.message?.text ||
        (data?.messageType === "voice" || data?.message?.messageType === "voice"
          ? "🎤 Voice message"
          : data?.messageType || data?.message?.messageType
          ? "Sent an attachment"
          : "New message");

      showBackgroundNotification(senderName, { body: preview, tag: `chat-${senderId}` });
    };

    socket.on("new_message", notifyIncoming);
    socket.on("receiveMessage", notifyIncoming);
    return () => {
      socket.off("new_message", notifyIncoming);
      socket.off("receiveMessage", notifyIncoming);
    };
  }, [notificationsEnabled]);

  const value = {
    unreadCount,
    setUnreadCount,
    notificationsEnabled,
    setNotificationsEnabled,
    notifications,
    setNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* react-hot-toast portal */}
      <Toaster position="top-right" />
    </NotificationContext.Provider>
  );
};

