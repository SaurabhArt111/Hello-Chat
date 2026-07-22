import React from "react";
import { AlertTriangle, ShieldAlert, Zap } from "lucide-react";

const severityConfig = {
  spam: {
    label: "Spam",
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  abuse: {
    label: "Abuse",
    icon: ShieldAlert,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  },
  threat: {
    label: "Threat",
    icon: Zap,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
  low: {
    label: "Low",
    icon: AlertTriangle,
    className: "bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400",
  },
  medium: {
    label: "Medium",
    icon: ShieldAlert,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  high: {
    label: "High",
    icon: Zap,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
};

const SeverityBadge = ({ severity = "low", size = "sm" }) => {
  const key = severity?.toLowerCase?.() || "low";
  const config = severityConfig[key] || severityConfig.low;
  const Icon = config.icon;
  const sizeClass = size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
};

export default SeverityBadge;
