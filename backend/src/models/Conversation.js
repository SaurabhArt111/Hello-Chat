import mongoose from "mongoose";

/**
 * Redesigned for scale. Previously this model was created on friend-accept
 * and then never read again - every chat-history/recent-chats query
 * instead scanned the ENTIRE Message collection with an $or on
 * sender/receiver, which does not scale past a small number of
 * users/messages (no way to paginate cheaply, full collection scans for
 * "recent chats", etc).
 *
 * Now:
 * - Every 1:1 Message carries a `conversationId` (see Message.js), so chat
 *   history is a single indexed range query, not an $or scan.
 * - `lastMessage`/`lastMessageAt` are denormalized here so the chat list
 *   ("recent chats") is a single indexed query + sort, not an aggregation
 *   over every message ever sent.
 * - `unreadCount` is a per-participant counter maintained on send/read
 *   instead of being recomputed by scanning messages.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Denormalized preview shown in the chat list, kept in sync by
    // messageController/messageUploadController on every new message.
    lastMessage: {
      text: { type: String, default: "" },
      messageType: { type: String, default: "text" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      encrypted: { type: Boolean, default: false },
    },
    lastMessageAt: { type: Date, default: Date.now },

    // Map keyed by userId (string) -> unread count for that participant.
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },

    // Whether both participants have E2EE keys and this conversation's
    // messages are encrypted end-to-end (see frontend/src/utils/e2ee.js).
    // Server-side translation is skipped for encrypted conversations since
    // the server never sees plaintext - see messageController.js.
    e2eeEnabled: { type: Boolean, default: false },

    archivedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pinnedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// One conversation per unordered pair of participants.
conversationSchema.index({ participants: 1 }, { unique: true });
// Recent-chats list: fetch by participant, sorted by activity - the single
// most frequent query in the whole app.
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

/** Find (or atomically create) the 1:1 conversation between two users. */
conversationSchema.statics.findOrCreateDirect = async function (userIdA, userIdB) {
  const participants = [String(userIdA), String(userIdB)].sort();
  const existing = await this.findOne({
    participants: { $all: participants, $size: 2 },
  });
  if (existing) return existing;

  try {
    return await this.create({ participants });
  } catch (err) {
    // Race: another request created it between our findOne and create.
    if (err.code === 11000) {
      const raceExisting = await this.findOne({
        participants: { $all: participants, $size: 2 },
      });
      if (raceExisting) return raceExisting;
    }
    throw err;
  }
};

export default mongoose.model("Conversation", conversationSchema);
