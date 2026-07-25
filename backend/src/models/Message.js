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
    /**
     * 1:1 messages only. Lets chat history be a single indexed range query
     * (`{conversationId, createdAt}`) instead of an `$or` scan over
     * sender/receiver - see models/Conversation.js for why.
     */
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    text: String,
    /**
     * End-to-end encryption (1:1 chats only - see frontend/src/utils/e2ee.js).
     * When `encrypted` is true, `text` is NOT readable plaintext: the real
     * content lives in `ciphertext` (NaCl box, base64) + `nonce`, and only
     * the two participants' devices can decrypt it. The server stores and
     * relays ciphertext only; `text`/`translatedText` are left blank for
     * encrypted messages so nothing readable ever touches the database.
     */
    encrypted: {
      type: Boolean,
      default: false,
    },
    ciphertext: String,
    nonce: String,
    // Sender's E2EE public key AT SEND TIME, so the recipient can verify
    // which keypair encrypted this message even if the sender later
    // rotates keys (e.g. new device/reinstall).
    senderE2eePublicKey: String,
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
    // Duration in seconds, used by voice-note playback (messageType: "voice")
    duration: Number,
    // Cloudinary public_id for fileUrl, so it can be deleted from storage
    // when the message is deleted-for-everyone.
    filePublicId: String,
    /**
     * Structured attachment metadata (mirrors fileUrl/fileName/fileSize/
     * duration above for the primary attachment, kept for backward
     * compatibility with existing UI code). `width`/`height` let the
     * client size image/video containers correctly *before* the media has
     * loaded, avoiding layout jumps; `thumbnailUrl` is used for video
     * poster frames.
     */
    attachments: [
      {
        url: String,
        publicId: String,
        mimeType: String,
        fileName: String,
        fileSize: Number, // bytes
        width: Number,
        height: Number,
        duration: Number,
        thumbnailUrl: String,
      },
    ],
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
messageSchema.index({ status: 1, createdAt: -1 });

// Primary pagination path for 1:1 chat history (see Conversation.js) -
// this single compound index replaces the old $or{sender,receiver} scan.
messageSchema.index({ conversationId: 1, createdAt: -1 });
// Primary pagination path for group chat history (getGroupMessages was
// previously unindexed and unpaginated - same "load everything" bug).
messageSchema.index({ group: 1, createdAt: -1 });
// Legacy/back-compat lookups (migration period, admin tooling, DMs sent
// before a conversationId existed on every row).
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
// Idempotent send/retry lookups (see saveMessage/uploadFile).
// Only index messages that actually provide a string clientMessageId. This
// avoids duplicate-null collisions when older documents include
// clientMessageId:null.
messageSchema.index(
  { sender: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  }
);

export default mongoose.model("Message", messageSchema);
