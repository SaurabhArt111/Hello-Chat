import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "spam", "abuse", "threat"],
      default: "low",
    },
    status: {
      type: String,
      enum: ["open", "reviewed", "action_taken", "dismissed"],
      default: "open",
    },
    actionTaken: {
      type: String,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);

