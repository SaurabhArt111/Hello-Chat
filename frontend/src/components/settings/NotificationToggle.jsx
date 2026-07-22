import React, { useState } from "react";
import axios from "../../api/axios";
import { useNotificationContext } from "../../context/NotificationContext";

const NotificationToggle = () => {
  const { notificationsEnabled, setNotificationsEnabled } =
    useNotificationContext();
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const userId = storedUser?.id || storedUser?._id;
    if (!userId) return;

    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    setLoading(true);

    try {
      await axios.put(`/notifications/${userId}`, { notifications: next });
    } catch (err) {
      console.error("Failed to update notification setting", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
        Notifications
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          notificationsEnabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-neutral-600"
        } ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            notificationsEnabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
};

export default NotificationToggle;

