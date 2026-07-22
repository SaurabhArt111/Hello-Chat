import AuditLog from "../models/AuditLog.js";

export const createAuditLog = async ({
  adminId,
  actionType,
  targetUserId,
  targetMessageId,
  metadata,
  req,
}) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;

    await AuditLog.create({
      adminId,
      actionType,
      targetUserId,
      targetMessageId,
      metadata,
      ip,
    });
  } catch (err) {
    console.error("AUDIT LOG ERROR:", err);
  }
};

