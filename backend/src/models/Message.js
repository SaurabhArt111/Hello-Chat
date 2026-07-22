import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    // Legacy type/file fields used throughout the app
    type: {
      type: String,
      default: "text", // text, image, video, file
    },
    file: String,
    // New fields for richer shared media support
    messageType: {
      type: String,
      enum: ["text", "image", "video", "file", "link", "voice"],
      default: "text",
    },
    fileUrl: String,
    fileName: String,
    fileSize: String,
    status: {
      type: String,
      // NOTE: We extend this enum to support server-side scheduling.
      // - "scheduled": created but not yet dispatched
      // - "cancelled": scheduled message cancelled by sender before dispatch
      enum: ["scheduled", "sent", "delivered", "seen", "cancelled"],
      default: "sent",
    },
    /**
     * Server-side scheduled messaging:
     * - scheduledFor: UTC date/time to dispatch
     * - sentAt: when the scheduler actually dispatched it
     */
    scheduledFor: Date,
    sentAt: Date,
    deliveredAt: Date,
    seenAt: Date,
    originalText: String,
    detectedLanguage: String,
    translatedText: String,
    // Message actions
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: String,
      },
    ],
    forwarded: {
      type: Boolean,
      default: false,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    // Group message translations for each member
    groupTranslations: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        translatedText: String,
      },
    ],
    /**
     * Client-generated id used for idempotent sends + retry queue.
     * Optional so we don't break existing data.
     */
    clientMessageId: {
      type: String,
    },
    /**
     * Optional device/session id (used to dedupe per device if desired).
     */
    senderDeviceId: {
      type: String,
    },
    /**
     * Group delivery/read receipts per member.
     * We roll these up into `status` to keep UI unchanged:
     * - status: "delivered" when ALL members (excluding sender) have deliveredAt
     * - status: "seen" when ALL members (excluding sender) have seenAt
     */
    groupReceipts: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        deliveredAt: Date,
        seenAt: Date,
      },
    ],
    senderDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Fast queries for scheduling + common access patterns
messageSchema.index({ status: 1, scheduledFor: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
