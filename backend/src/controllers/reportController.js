import Report from "../models/Report.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { createAuditLog } from "../utils/createAuditLog.js";

export const createReport = async (req, res) => {
  try {
    const { messageId, reason } = req.body;

    if (!messageId || !reason) {
      return res
        .status(400)
        .json({ message: "messageId and reason are required" });
    }

    const report = await Report.create({
      reporterId: req.user,
      messageId,
      reason,
    });

    return res.status(201).json(report);
  } catch (err) {
    console.error("CREATE REPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to create report" });
  }
};

export const getReportStats = async (req, res) => {
  try {
    const [total, open, actionTaken, dismissed, highSeverity] = await Promise.all([
      Report.countDocuments({}),
      Report.countDocuments({ status: "open" }),
      Report.countDocuments({ status: "action_taken" }),
      Report.countDocuments({ status: "dismissed" }),
      Report.countDocuments({ severity: { $in: ["high", "threat", "abuse"] } }),
    ]);
    return res.json({
      total,
      open,
      actionTaken,
      dismissed,
      highSeverity,
    });
  } catch (err) {
    console.error("GET REPORT STATS ERROR:", err);
    return res.status(500).json({ message: "Failed to load report stats" });
  }
};

export const getReports = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const status = req.query.status?.trim();
    const severity = req.query.severity?.trim();
    const search = (req.query.search || "").trim();

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (search) {
      filter.$or = [
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("reporterId", "username email")
        .populate({
          path: "messageId",
          select: "text sender createdAt",
          populate: { path: "sender", select: "username" },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ]);

    return res.json({
      reports,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("GET REPORTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load reports" });
  }
};

export const handleReport = async (req, res) => {
  try {
    const { action } = req.body; // "warn" | "delete_message" | "ban_user" | "dismiss"
    const reportId = req.params.reportId;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const message = await Message.findById(report.messageId);
    if (!message && action !== "dismiss") {
      return res.status(404).json({ message: "Message not found" });
    }

    let offender = null;
    if (message) {
      offender = await User.findById(message.sender);
    }

    if (!offender && action === "ban_user") {
      return res.status(404).json({ message: "User not found" });
    }

    if (action === "delete_message" && message) {
      await Message.deleteOne({ _id: message._id });
    } else if (action === "ban_user" && offender) {
      offender.isBanned = true;
      await offender.save();
    } else if (action === "dismiss") {
      // just mark as dismissed
    } else if (action === "warn") {
      // could send notification/email here
    }

    report.status = action === "dismiss" ? "dismissed" : "action_taken";
    report.actionTaken = action;
    report.handledBy = req.user;
    await report.save();

    await createAuditLog({
      adminId: req.user,
      actionType: `REPORT_${String(action || "").toUpperCase()}`,
      targetUserId: offender?._id,
      targetMessageId: message?._id,
      metadata: { reportId: report._id },
      req,
    });

    return res.json({ message: "Action applied", report });
  } catch (err) {
    console.error("HANDLE REPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to handle report" });
  }
};

