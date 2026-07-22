import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const KPICard = ({
  label,
  value,
  description,
  change,
  icon: Icon,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="h-4 w-24 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse mb-3" />
        <div className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse mb-2" />
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
      </div>
    );
  }

  const changeNum = typeof change === "number" ? change : 0;
  const ChangeIcon =
    changeNum > 0 ? TrendingUp : changeNum < 0 ? TrendingDown : Minus;
  const changeColor =
    changeNum > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : changeNum < 0
      ? "text-red-600 dark:text-red-400"
      : "text-gray-500 dark:text-neutral-400";

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-400 truncate">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-neutral-100 tabular-nums">
            {value != null ? value.toLocaleString() : "—"}
          </p>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400 line-clamp-2">
              {description}
            </p>
          )}
          {changeNum !== 0 && (
            <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${changeColor}`}>
              <ChangeIcon className="h-4 w-4" />
              <span>{Math.abs(changeNum)}% vs last 7 days</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="ml-3 flex-shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-2.5">
            <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
