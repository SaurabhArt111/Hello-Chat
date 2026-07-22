import React from "react";
import { Circle, Ban, UserX } from "lucide-react";

const statusConfig = {
  online: {
    label: "Online",
    icon: Circle,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    iconClassName: "fill-emerald-500",
  },
  offline: {
    label: "Offline",
    icon: Circle,
    className: "bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400",
    iconClassName: "fill-gray-400",
  },
  banned: {
    label: "Banned",
    icon: Ban,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  deactivated: {
    label: "Deactivated",
    icon: UserX,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
};

const StatusBadge = ({ status = "offline", size = "sm" }) => {
  const config = statusConfig[status] || statusConfig.offline;
  const Icon = config.icon;
  const sizeClass = size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${config.className}`}
    >
      <Icon className={`h-3 w-3 ${config.iconClassName}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
