import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actionType: {
      type: String,
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    targetMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    metadata: {
      type: Object,
      default: {},
    },
    ip: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);

