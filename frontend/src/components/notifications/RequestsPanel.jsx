import React, { useEffect, useState } from "react";
import Avatar from "../common/Avatar";
import {
  getIncomingRequests,
  acceptRequest,
  rejectRequest,
  blockFromRequest,
  undoRejectRequest,
} from "../../api/friends";
import axios from "../../api/axios";
import { useNotificationContext } from "../../context/NotificationContext";
import { toast } from "react-hot-toast";

const RequestsPanel = ({ onClose }) => {
  const [requests, setRequests] = useState([]);
  const { setUnreadCount, notifications, setNotifications } = useNotificationContext();

  useEffect(() => {
    loadRequests();
    markAllNotificationsAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRequests = async () => {
    try {
      const res = await getIncomingRequests();
      setRequests(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      // Mark ALL unread notifications as read when panel opens
      const unreadNotifications = (notifications || []).filter(
        (n) => !n.isRead
      );

      if (unreadNotifications.length === 0) return;

      await Promise.all(
        unreadNotifications.map((n) =>
          axios.patch(`/notifications/read/${n._id}`).catch((err) => {
            console.error(`Failed to mark notification ${n._id} as read:`, err);
            return null;
          })
        )
      );

      // Recalculate badge count from actual unread notifications (more reliable)
      const remainingUnread = (notifications || []).filter(
        (n) => !unreadNotifications.some((u) => String(u._id) === String(n._id)) && !n.isRead
      ).length;
      setUnreadCount(remainingUnread);

      // Keep NotificationContext.notifications in sync (no refetch)
      setNotifications((prev) =>
        (prev || []).map((n) =>
          unreadNotifications.some((u) => String(u._id) === String(n._id))
            ? { ...n, isRead: true }
            : n
        )
      );
    } catch (err) {
      console.log("Failed to mark notifications as read", err);
    }
  };

  const handleAccept = async (id) => {
    await acceptRequest(id);
    setRequests((prev) => prev.filter((r) => r._id !== id));
  };

  const handleReject = async (id) => {
    try {
      await rejectRequest(id);
      setRequests((prev) => prev.filter((r) => r._id !== id));

      const toastId = toast(
        (t) => (
          <div className="text-sm text-gray-900 dark:text-neutral-100">
            <span>Request rejected.</span>
            <button
              type="button"
              className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold underline"
              onClick={async () => {
                try {
                  await undoRejectRequest(id);
                  toast.dismiss(t.id);
                  toast.success("Request restored");
                  // Reload to reflect restored pending request
                  loadRequests();
                } catch (err) {
                  console.error("Undo reject failed", err);
                  toast.error("Undo expired or failed");
                }
              }}
            >
              Undo
            </button>
          </div>
        ),
        { duration: 10000 }
      );
      return toastId;
    } catch (err) {
      console.error("Reject failed", err);
      toast.error("Failed to reject request");
    }
  };

  const handleBlock = async (id) => {
    try {
      await blockFromRequest(id);
      setRequests((prev) => prev.filter((r) => r._id !== id));
      toast.success("User blocked and request cancelled");
    } catch (err) {
      console.error("Block from request failed", err);
      toast.error("Failed to block user");
    }
  };

  return (
    <div className="w-full md:w-[360px] h-full">
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5 flex flex-col">

        {/* Header */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 md:p-6 shadow-lg border border-gray-200 dark:border-neutral-700 relative mb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            ✕
          </button>

          <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Notification</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            You have notifications about friend request and other updates here.
          </p>
        </div>

        {/* List */}
        <div className="space-y-4">
          {requests.length === 0 && (!notifications || notifications.length === 0) && (
            <p className="text-center text-gray-500 dark:text-neutral-400 text-sm py-6">
              No notifications at the moment.
            </p>
          )}

          {/* Friend requests */}
          {requests.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 px-1">
              Friend requests
            </p>
          )}

          {requests.map((req) => (
            <div
              key={req._id}
              className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-neutral-700 flex flex-col gap-3 hover:border-gray-300 dark:hover:border-neutral-600 transition-all duration-200"
            >
              {/* First line: Logo, name, and bio */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar
                  name={req.sender.username}
                  src={req.sender.avatar}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-neutral-100 truncate">
                    {req.sender.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                    {req.sender.bio || "wants to connect"}
                  </p>
                </div>
              </div>

              {/* Second line: Action buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleAccept(req._id)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-4 py-2 rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
                >
                  Accept
                </button>

                <button
                  onClick={() => handleReject(req._id)}
                  className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
                >
                  Reject
                </button>

                <button
                  onClick={() => handleBlock(req._id)}
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-800 dark:text-neutral-100 text-xs px-3 py-2 rounded-xl font-medium shadow-sm transition-all duration-200 active:scale-95"
                  title="Block user"
                >
                  Block
                </button>
              </div>
            </div>
          ))}

          {/* Other notifications (missed calls, request accepted/rejected, etc.) */}
          {notifications && notifications.filter((n) => n.type !== "friend_request").length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 px-1 mt-2">
              Recent activity
            </p>
          )}

          {notifications &&
            notifications
              .filter((n) => n.type !== "friend_request")
              .map((n) => {
                let title = "Notification";
                if (n.type === "missed_call") {
                  const callType =
                    n.metadata?.callType === "video" ? "video" : "audio";
                  title = `Missed ${callType} call`;
                } else if (n.type === "friend_request_accepted") {
                  title = "Your friend request was accepted";
                } else if (n.type === "friend_request_rejected") {
                  title = "Your friend request was rejected";
                }

                const created =
                  n.createdAt && !Number.isNaN(new Date(n.createdAt).getTime())
                    ? new Date(n.createdAt).toLocaleString()
                    : "";

                return (
                  <div
                    key={n._id}
                    className="bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-md border border-gray-200 dark:border-neutral-700 flex flex-col gap-1"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                      {title}
                    </p>
                    {created && (
                      <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                        {created}
                      </p>
                    )}
                  </div>
                );
              })}
        </div>

      </div>
    </div>
  );
};

export default RequestsPanel;
