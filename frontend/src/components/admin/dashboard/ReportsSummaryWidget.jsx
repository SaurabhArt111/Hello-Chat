import React from "react";
import { Flag, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const ReportsSummaryWidget = ({
  pending = 0,
  resolved = 0,
  highSeverity = 0,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 h-[200px]">
        <div className="h-4 w-36 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-10 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse" />
          <div className="h-10 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse" />
          <div className="h-10 rounded-lg bg-gray-200 dark:bg-neutral-600 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
          <Flag className="h-4 w-4 text-amber-500" />
          Reports Summary
        </h3>
        <Link
          to="/admin/reports"
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border border-amber-100 dark:border-amber-800/50">
          <span className="text-sm text-amber-800 dark:text-amber-200">Pending</span>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{pending}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 border border-emerald-100 dark:border-emerald-800/50">
          <span className="text-sm text-emerald-800 dark:text-emerald-200">Resolved</span>
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{resolved}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 border border-red-100 dark:border-red-800/50">
          <span className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            High severity
          </span>
          <span className="text-lg font-bold text-red-700 dark:text-red-300">{highSeverity}</span>
        </div>
      </div>
      <Link
        to="/admin/reports"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
      >
        Manage Reports
      </Link>
    </div>
  );
};

export default ReportsSummaryWidget;
