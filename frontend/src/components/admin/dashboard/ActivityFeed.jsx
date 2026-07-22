import React from "react";
import {
  UserPlus,
  Shield,
  Flag,
  Ban,
  UserCheck,
  LogOut,
  MessageSquare,
} from "lucide-react";

const activityIcons = {
  registration: UserPlus,
  admin_action: Shield,
  report: Flag,
};

const actionLabels = {
  BAN_USER: "banned user",
  UNBAN_USER: "unbanned user",
  DEACTIVATE_USER: "deactivated user",
  FORCE_LOGOUT: "force logged out",
  REPORT_WARN: "warned user",
  REPORT_DELETE_MESSAGE: "deleted message",
  REPORT_BAN_USER: "banned user",
  REPORT_DISMISSED: "dismissed report",
};

const ActivityFeed = ({ activities = [], loading = false }) => {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 h-[280px]">
        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-neutral-600 animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-full rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-2" />
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  const renderActivity = (a) => {
    const Icon = activityIcons[a.type] || Shield;
    const iconBg =
      a.type === "registration"
        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        : a.type === "report"
        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";

    if (a.type === "registration") {
      return (
        <div key={a.createdAt + a.username} className="flex gap-3 py-2">
          <div className={`flex-shrink-0 rounded-full p-2 ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900 dark:text-neutral-100">
              <span className="font-medium">{a.username}</span> registered
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              {formatTime(a.createdAt)}
            </p>
          </div>
        </div>
      );
    }

    if (a.type === "admin_action") {
      const actionLabel = actionLabels[a.actionType] || a.actionType?.replace(/_/g, " ").toLowerCase();
      return (
        <div key={a.createdAt + a.actionType + a.targetUsername} className="flex gap-3 py-2">
          <div className={`flex-shrink-0 rounded-full p-2 ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900 dark:text-neutral-100">
              <span className="font-medium">{a.adminUsername || "Admin"}</span> {actionLabel}
              {a.targetUsername && (
                <span> {" "}<span className="font-medium">{a.targetUsername}</span></span>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              {formatTime(a.createdAt)}
            </p>
          </div>
        </div>
      );
    }

    if (a.type === "report") {
      return (
        <div key={a.createdAt + a.reporterUsername} className="flex gap-3 py-2">
          <div className={`flex-shrink-0 rounded-full p-2 ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900 dark:text-neutral-100">
              <span className="font-medium">{a.reporterUsername || "User"}</span> reported content
              {a.reason && (
                <span className="text-gray-500 dark:text-neutral-400">: {a.reason}…</span>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              {formatTime(a.createdAt)}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mb-4">
        Activity Feed
      </h3>
      <div className="space-y-0 max-h-[280px] overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-neutral-400 py-8 text-center">
            No recent activity
          </p>
        ) : (
          activities.map((a) => renderActivity(a))
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
