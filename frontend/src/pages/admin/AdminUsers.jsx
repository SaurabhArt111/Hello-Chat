import React, { useEffect, useState } from "react";
import { useToastContext } from "../../context/ToastContext";
import {
  getAdminUsers,
  getAdminUserById,
  banUser,
  unbanUser,
  deactivateUser,
  forceLogoutUser,
} from "../../api/admin";
import ConfirmModal from "../../components/admin/ConfirmModal";
import StatusBadge from "../../components/admin/ui/StatusBadge";
import Pagination from "../../components/admin/ui/Pagination";
import TableSkeleton from "../../components/admin/ui/TableSkeleton";
import EmptyState from "../../components/admin/ui/EmptyState";
import SideDrawer from "../../components/admin/ui/SideDrawer";
import { Users, Search, RotateCcw, ChevronRight } from "lucide-react";

const AdminUsers = () => {
  const toast = useToastContext();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [drawerUser, setDrawerUser] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const limit = 20;

  const load = async (pageArg = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminUsers(pageArg, search, limit, role, status, sort, order);
      setUsers(res.data.users || []);
      setPage(res.data.page || 1);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [role, status, sort, order]);

  const handleSearch = () => load(1);
  const handleReset = () => {
    setSearch("");
    setRole("");
    setStatus("");
    setSort("createdAt");
    setOrder("desc");
    setSelectedIds(new Set());
    setTimeout(() => load(1), 0);
  };

  const openConfirm = (action, user) => {
    setPendingAction({ action, user });
  };

  const closeConfirm = () => setPendingAction(null);

  const performAction = async () => {
    if (!pendingAction) return;
    const { action, user } = pendingAction;
    try {
      if (action === "ban") {
        await banUser(user._id);
        toast.success("User banned");
      } else if (action === "unban") {
        await unbanUser(user._id);
        toast.success("User unbanned");
      } else if (action === "deactivate") {
        await deactivateUser(user._id);
        toast.success("User deactivated");
      } else if (action === "forceLogout") {
        await forceLogoutUser(user._id);
        toast.success("User logged out");
      }
      await load(page);
      setDrawerUser(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      closeConfirm();
    }
  };

  const performBulkAction = async (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        if (action === "ban") await banUser(id);
        else if (action === "deactivate") await deactivateUser(id);
        else if (action === "forceLogout") await forceLogoutUser(id);
      }
      setSelectedIds(new Set());
      toast.success(`Bulk ${action} completed for ${ids.length} user(s)`);
      await load(page);
      setDrawerUser(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Bulk action failed");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const actives = users.filter((u) => u.role !== "admin");
    if (selectedIds.size >= actives.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(actives.map((u) => u._id)));
  };

  const openDrawer = async (user) => {
    setDrawerUser(user);
    setDrawerLoading(true);
    try {
      const res = await getAdminUserById(user._id);
      setDrawerUser(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const getStatus = (u) => {
    if (u.isBanned) return "banned";
    if (!u.isOnline) return "offline";
    return "online";
  };

  const selectableUsers = users.filter((u) => u.role !== "admin");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="h-7 w-7" />
          Users
        </h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
        <select
          value={`${sort}-${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split("-");
            setSort(s);
            setOrder(o);
          }}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="createdAt-desc">Newest first</option>
          <option value="createdAt-asc">Oldest first</option>
          <option value="username-asc">Name A–Z</option>
          <option value="username-desc">Name Z–A</option>
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

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => performBulkAction("ban")}
            className="rounded-lg border border-red-500 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Ban
          </button>
          <button
            type="button"
            onClick={() => performBulkAction("deactivate")}
            className="rounded-lg border border-gray-400 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            Deactivate
          </button>
          <button
            type="button"
            onClick={() => performBulkAction("forceLogout")}
            className="rounded-lg border border-orange-500 px-3 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30"
          >
            Force logout
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={10} cols={6} />
      ) : error ? (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 p-6 text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
          <EmptyState icon={Users} message="No users found" submessage="Try adjusting filters" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl bg-white shadow border border-gray-200 dark:bg-neutral-800 dark:border-neutral-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectableUsers.length > 0 && selectedIds.size >= selectableUsers.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u._id}
                    className="border-t border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {u.role !== "admin" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u._id)}
                          onChange={() => toggleSelect(u._id)}
                          className="rounded border-gray-300"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDrawer(u)}
                        className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
                      >
                        {u.username}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-neutral-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-neutral-600">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={getStatus(u)} />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {u.role !== "admin" && (
                        <>
                          {u.isBanned ? (
                            <button
                              type="button"
                              onClick={() => openConfirm("unban", u)}
                              className="rounded-lg border border-emerald-500 px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openConfirm("ban", u)}
                              className="rounded-lg border border-red-500 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              Ban
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openConfirm("deactivate", u)}
                            className="rounded-lg border border-gray-400 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-700"
                          >
                            Deactivate
                          </button>
                          <button
                            type="button"
                            onClick={() => openConfirm("forceLogout", u)}
                            className="rounded-lg border border-orange-500 px-3 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                          >
                            Force logout
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={(p) => load(p)}
            />
          </div>
        </>
      )}

      <ConfirmModal
        open={!!pendingAction}
        title="Confirm action"
        message={
          pendingAction
            ? `Are you sure you want to ${pendingAction.action} ${pendingAction.user?.username}?`
            : ""
        }
        onConfirm={performAction}
        onCancel={closeConfirm}
        destructive={pendingAction?.action === "unban" ? false : true}
        confirmLabel={pendingAction?.action === "unban" ? "Unban" : "Confirm"}
      />

      <SideDrawer
        open={!!drawerUser}
        onClose={() => setDrawerUser(null)}
        title={drawerUser?.username || "User details"}
      >
        {drawerLoading ? (
          <div className="space-y-4">
            <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-neutral-600 animate-pulse" />
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
            <div className="h-4 w-full rounded bg-gray-200 dark:bg-neutral-600 animate-pulse" />
          </div>
        ) : drawerUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={drawerUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(drawerUser.username)}`}
                alt={drawerUser.username}
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 dark:border-neutral-600"
              />
              <div>
                <h3 className="font-semibold text-lg">{drawerUser.username}</h3>
                <StatusBadge status={getStatus(drawerUser)} size="lg" />
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-neutral-400">Email</dt>
                <dd className="font-medium">{drawerUser.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-neutral-400">Role</dt>
                <dd className="font-medium">{drawerUser.role}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-neutral-400">Joined</dt>
                <dd className="font-medium">
                  {drawerUser.createdAt
                    ? new Date(drawerUser.createdAt).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-neutral-400">Last activity</dt>
                <dd className="font-medium">
                  {drawerUser.lastSeen
                    ? new Date(drawerUser.lastSeen).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-neutral-400">Total messages</dt>
                <dd className="font-medium">{drawerUser.totalMessages ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-neutral-400">Reports against</dt>
                <dd className="font-medium">{drawerUser.reportsCount ?? "—"}</dd>
              </div>
              {drawerUser.bio && (
                <div>
                  <dt className="text-gray-500 dark:text-neutral-400">Bio</dt>
                  <dd className="font-medium">{drawerUser.bio}</dd>
                </div>
              )}
            </dl>
            {drawerUser.role !== "admin" && (
              <div className="pt-4 flex flex-wrap gap-2">
                {drawerUser.isBanned ? (
                  <button
                    type="button"
                    onClick={() => openConfirm("unban", drawerUser)}
                    className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConfirm("ban", drawerUser)}
                    className="rounded-lg border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Ban
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openConfirm("deactivate", drawerUser)}
                  className="rounded-lg border border-gray-400 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-700"
                >
                  Deactivate
                </button>
                <button
                  type="button"
                  onClick={() => openConfirm("forceLogout", drawerUser)}
                  className="rounded-lg border border-orange-500 px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                >
                  Force logout
                </button>
              </div>
            )}
          </div>
        ) : null}
      </SideDrawer>
    </div>
  );
};

export default AdminUsers;
