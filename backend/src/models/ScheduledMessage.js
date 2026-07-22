import mongoose from "mongoose";

const scheduledMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text: String,
    type: {
      type: String,
      default: "text",
      enum: ["text", "image", "video", "file", "link", "voice"],
    },
    file: String,
    fileUrl: String,
    fileName: String,
    fileSize: String,
    scheduledFor: {
      type: Date,
      required: true,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    sentAt: Date,
    error: String,
  },
  { timestamps: true }
);

// Index for efficient cron job queries
scheduledMessageSchema.index({ scheduledFor: 1, sent: 1 });

export default mongoose.model("ScheduledMessage", scheduledMessageSchema);
