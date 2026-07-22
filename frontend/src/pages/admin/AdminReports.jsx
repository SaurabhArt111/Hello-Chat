import React, { useEffect, useState } from "react";
import { useToastContext } from "../../context/ToastContext";
import {
  getAdminReports,
  getAdminReportStats,
  handleAdminReport,
} from "../../api/admin";
import ConfirmModal from "../../components/admin/ConfirmModal";
import SeverityBadge from "../../components/admin/ui/SeverityBadge";
import Pagination from "../../components/admin/ui/Pagination";
import TableSkeleton from "../../components/admin/ui/TableSkeleton";
import EmptyState from "../../components/admin/ui/EmptyState";
import {
  Flag,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MessageSquareOff,
  Ban,
  XCircle,
} from "lucide-react";

const AdminReports = () => {
  const toast = useToastContext();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const limit = 20;

  const loadReports = async (pageArg = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminReports(pageArg, limit, status, severity, search);
      const data = res.data;
      setReports(data.reports || []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await getAdminReportStats();
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadReports(1);
  }, [status, severity]);

  useEffect(() => {
    loadStats();
  }, []);

  const handleSearch = () => loadReports(1);
  const handleReset = () => {
    setSearch("");
    setStatus("");
    setSeverity("");
    setTimeout(() => loadReports(1), 0);
  };

  const open = (report, action) => setPending({ report, action });
  const close = () => setPending(null);

  const perform = async () => {
    if (!pending) return;
    try {
      await handleAdminReport(pending.report._id, pending.action);
      toast.success("Report action completed");
      await loadReports(page);
      await loadStats();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      close();
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const actionLabels = {
    warn: "Warn user",
    delete_message: "Delete message",
    ban_user: "Ban user",
    dismiss: "Dismiss",
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Flag className="h-7 w-7" />
          Reports
        </h1>
      </div>

      {/* Stats cards */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-4">
            <p className="text-sm text-gray-500 dark:text-neutral-400">Total</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">Pending</p>
            <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
              {stats.open}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Resolved</p>
            <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
              {stats.actionTaken}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-600 p-4">
            <p className="text-sm text-gray-600 dark:text-neutral-400">Dismissed</p>
            <p className="text-2xl font-semibold">{stats.dismissed}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-300">High severity</p>
            <p className="text-2xl font-semibold text-red-700 dark:text-red-300">
              {stats.highSeverity}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search in reason"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="">All status</option>
          <option value="open">Open</option>
          <option value="action_taken">Action taken</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="">All severity</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="spam">Spam</option>
          <option value="abuse">Abuse</option>
          <option value="threat">Threat</option>
        </select>
        <button
          type="button"
          onClick={handleSearch}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : error ? (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 p-6 text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
          <EmptyState icon={Flag} message="No reports" submessage="Try adjusting filters" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl bg-white shadow border border-gray-200 dark:bg-neutral-800 dark:border-neutral-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-700">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 text-left">Reporter</th>
                  <th className="px-4 py-3 text-left">Message</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const isExpanded = expandedId === r._id;
                  const msg = r.messageId;
                  const reportedText = msg?.text || "(deleted)";
                  const senderName = msg?.sender?.username ?? "Unknown";

                  return (
                    <React.Fragment key={r._id}>
                      <tr className="border-t border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r._id)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-neutral-600"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          {r.reporterId?.username || "Unknown"}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" title={reportedText}>
                          {reportedText}
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate" title={r.reason}>
                          {r.reason}
                        </td>
                        <td className="px-4 py-2">
                          <SeverityBadge severity={r.severity || "low"} />
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              r.status === "open"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                : r.status === "action_taken"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : "bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right space-x-2">
                          {r.status === "open" && (
                            <>
                              <button
                                type="button"
                                onClick={() => open(r, "warn")}
                                className="inline-flex items-center gap-1 rounded-lg border border-yellow-500 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/30"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Warn
                              </button>
                              <button
                                type="button"
                                onClick={() => open(r, "delete_message")}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              >
                                <MessageSquareOff className="h-3 w-3" />
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => open(r, "ban_user")}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-700 px-3 py-1 text-xs text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                              >
                                <Ban className="h-3 w-3" />
                                Ban
                              </button>
                              <button
                                type="button"
                                onClick={() => open(r, "dismiss")}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-400 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:hover:bg-neutral-700"
                              >
                                <XCircle className="h-3 w-3" />
                                Dismiss
                              </button>
                            </>
                          )}
                          {r.status !== "open" && r.actionTaken && (
                            <span className="text-xs text-gray-500 dark:text-neutral-400">
                              {actionLabels[r.actionTaken] || r.actionTaken}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-gray-100 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-700/30">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium text-gray-600 dark:text-neutral-400">
                                  Full reason:
                                </span>{" "}
                                {r.reason}
                              </div>
                              <div>
                                <span className="font-medium text-gray-600 dark:text-neutral-400">
                                  Reported message:
                                </span>{" "}
                                {reportedText}
                              </div>
                              <div>
                                <span className="font-medium text-gray-600 dark:text-neutral-400">
                                  Reported by:
                                </span>{" "}
                                {r.reporterId?.username || "Unknown"} (
                                {r.reporterId?.email || "—"})
                              </div>
                              <div>
                                <span className="font-medium text-gray-600 dark:text-neutral-400">
                                  Message sent by:
                                </span>{" "}
                                {msg?.sender?.username || "Unknown"}
                              </div>
                              <div>
                                <span className="font-medium text-gray-600 dark:text-neutral-400">
                                  Reported at:
                                </span>{" "}
                                {r.createdAt
                                  ? new Date(r.createdAt).toLocaleString()
                                  : "—"}
                              </div>
                              {r.actionTaken && (
                                <div>
                                  <span className="font-medium text-gray-600 dark:text-neutral-400">
                                    Action taken:
                                  </span>{" "}
                                  {actionLabels[r.actionTaken] || r.actionTaken}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={(p) => loadReports(p)}
            />
          </div>
        </>
      )}

      <ConfirmModal
        open={!!pending}
        title="Confirm action"
        message={
          pending
            ? `Are you sure you want to ${pending.action.replace("_", " ")} for this report?`
            : ""
        }
        onConfirm={perform}
        onCancel={close}
      />
    </div>
  );
};

export default AdminReports;
