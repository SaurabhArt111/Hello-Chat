import React from "react";
import { Activity, Database, Clock, Users } from "lucide-react";

const StatusBadge = ({ status }) => {
  const isHealthy = status === "healthy";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isHealthy
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : status === "degraded"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isHealthy ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-red-500"
        }`}
      />
      {status}
    </span>
  );
};

const formatUptime = (seconds) => {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${m}m`;
};

const SystemHealthWidget = ({
  api = "healthy",
  database = "healthy",
  uptimeSeconds = 0,
  activeSessions = 0,
  databaseLatencyMs,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 h-[200px]">
        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-12 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse" />
          <div className="h-12 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-500" />
        System Health
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-neutral-400 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            API
          </span>
          <StatusBadge status={api} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-neutral-400 flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-400" />
            Database
          </span>
          <div className="flex items-center gap-2">
            <StatusBadge status={database} />
            {databaseLatencyMs != null && (
              <span className="text-xs text-gray-500 dark:text-neutral-500">
                {databaseLatencyMs}ms
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-neutral-400 flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Uptime
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
            {formatUptime(uptimeSeconds)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-neutral-400 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Active sessions
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
            {activeSessions}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthWidget;
