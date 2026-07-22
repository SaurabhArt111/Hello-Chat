import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import {
  getDashboardStats,
  getDashboardCharts,
  getActivityFeed,
  getTopActiveUsers,
  getSystemHealth,
  getUsers,
  getUserById,
  banUser,
  unbanUser,
  deactivateUser,
  forceLogoutUser,
} from "../controllers/adminController.js";
import { getReports, getReportStats, handleReport } from "../controllers/reportController.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/dashboard", getDashboardStats);
router.get("/dashboard/charts", getDashboardCharts);
router.get("/dashboard/activity", getActivityFeed);
router.get("/dashboard/top-users", getTopActiveUsers);
router.get("/dashboard/health", getSystemHealth);
router.get("/users", getUsers);
router.get("/users/:userId", getUserById);

router.post("/users/:userId/ban", banUser);
router.post("/users/:userId/unban", unbanUser);
router.post("/users/:userId/deactivate", deactivateUser);
router.post("/users/:userId/force-logout", forceLogoutUser);

router.get("/reports", getReports);
router.get("/reports/stats", getReportStats);
router.post("/reports/:reportId/action", handleReport);

export default router;

