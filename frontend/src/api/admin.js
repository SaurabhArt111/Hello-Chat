import axios from "./axios";

export const getAdminDashboard = () => axios.get("/admin/dashboard");
export const getAdminDashboardCharts = () => axios.get("/admin/dashboard/charts");
export const getAdminActivityFeed = (limit = 20) =>
  axios.get("/admin/dashboard/activity", { params: { limit } });
export const getAdminTopActiveUsers = (limit = 10) =>
  axios.get("/admin/dashboard/top-users", { params: { limit } });
export const getAdminSystemHealth = () => axios.get("/admin/dashboard/health");

export const getAdminUsers = (page = 1, search = "", limit = 20, role = "", status = "", sort = "createdAt", order = "desc") =>
  axios.get("/admin/users", {
    params: { page, search, limit, role, status, sort, order },
  });

export const getAdminUserById = (userId) =>
  axios.get(`/admin/users/${userId}`);

export const banUser = (userId) =>
  axios.post(`/admin/users/${userId}/ban`);

export const unbanUser = (userId) =>
  axios.post(`/admin/users/${userId}/unban`);

export const deactivateUser = (userId) =>
  axios.post(`/admin/users/${userId}/deactivate`);

export const forceLogoutUser = (userId) =>
  axios.post(`/admin/users/${userId}/force-logout`);

export const getAdminReports = (page = 1, limit = 20, status = "", severity = "", search = "") =>
  axios.get("/admin/reports", {
    params: { page, limit, status, severity, search },
  });

export const getAdminReportStats = () => axios.get("/admin/reports/stats");

export const handleAdminReport = (reportId, action) =>
  axios.post(`/admin/reports/${reportId}/action`, { action });

