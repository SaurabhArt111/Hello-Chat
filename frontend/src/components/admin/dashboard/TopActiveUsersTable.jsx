import React from "react";
import { Link } from "react-router-dom";
import { Users, MessageSquare, ChevronRight } from "lucide-react";

const TopActiveUsersTable = ({ users = [], loading = false }) => {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 h-[280px]">
        <div className="h-4 w-36 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-neutral-600 animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse mb-2" />
                <div className="h-3 w-16 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-500" />
          Top Active Users
        </h3>
        <Link
          to="/admin/users"
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-neutral-700">
              <th className="text-left py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                User
              </th>
              <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                Messages
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-neutral-400">
                  No data yet
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <tr
                  key={u._id || i}
                  className="border-b border-gray-100 dark:border-neutral-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-700/30 transition-colors"
                >
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {(u.username || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-neutral-100">
                          {u.username || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 truncate max-w-[120px]">
                          {u.email || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-gray-700 dark:text-neutral-300">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {u.messageCount?.toLocaleString() ?? 0}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <Link
                      to="/admin/users"
                      className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopActiveUsersTable;
