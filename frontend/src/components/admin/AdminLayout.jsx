import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const AdminLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-neutral-900">
      <aside className="w-64 bg-white dark:bg-neutral-800 border-r border-gray-200 dark:border-neutral-700 flex flex-col">
        <div className="px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-xl text-emerald-500">
            Admin Panel
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-red-600 dark:text-red-300 hover:underline"
          >
            Logout
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <AdminNavLink to="/admin/dashboard" label="Dashboard" />
          <AdminNavLink to="/admin/users" label="Users" />
          <AdminNavLink to="/admin/reports" label="Reports" />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

const AdminNavLink = ({ to, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `block px-3 py-2 rounded-lg text-sm ${
        isActive
          ? "bg-emerald-500 text-white"
          : "text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700"
      }`
    }
  >
    {label}
  </NavLink>
);

export default AdminLayout;

