/**
 * One-time migration: backfills the new scalable schema onto data created
 * before this update.
 *
 * What it does:
 * 1. For every distinct 1:1 sender/receiver pair in the Message collection,
 *    finds-or-creates the matching Conversation doc.
 * 2. Sets `conversationId` on every message in that pair that doesn't have
 *    one yet.
 * 3. Recomputes each Conversation's `lastMessage`/`lastMessageAt` and
 *    `unreadCount` from the actual message history.
 *
 * Run once, after deploying the new schema, with:
 *   cd backend && node scripts/migrateConversations.js
 *
 * Safe to re-run - every step is idempotent (upsert / overwrite-with-
 * current-truth), so interrupting and re-running just re-derives the same
 * end state instead of duplicating anything.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Message from "../src/models/Message.js";
import Conversation from "../src/models/Conversation.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB. Starting migration...");

  // Distinct 1:1 pairs that don't have a conversationId yet.
  const pairs = await Message.aggregate([
    { $match: { group: { $exists: false }, receiver: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: {
          pair: {
            $cond: [
              { $lt: ["$sender", "$receiver"] },
              { a: "$sender", b: "$receiver" },
              { a: "$receiver", b: "$sender" },
            ],
          },
        },
      },
    },
  ]);

  console.log(`Found ${pairs.length} distinct 1:1 conversations to backfill.`);

  let migrated = 0;
  for (const { _id } of pairs) {
    const { a, b } = _id.pair;
    if (!a || !b) continue;

    const conversation = await Conversation.findOrCreateDirect(a, b);

    await Message.updateMany(
      {
        group: { $exists: false },
        conversationId: { $exists: false },
        $or: [
          { sender: a, receiver: b },
          { sender: b, receiver: a },
        ],
      },
      { $set: { conversationId: conversation._id } }
    );

    const lastMsg = await Message.findOne({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .lean();

    const unreadA = await Message.countDocuments({
      conversationId: conversation._id,
      sender: b,
      status: { $ne: "seen" },
    });
    const unreadB = await Message.countDocuments({
      conversationId: conversation._id,
      sender: a,
      status: { $ne: "seen" },
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: lastMsg
            ? {
                text: lastMsg.encrypted ? "" : lastMsg.text || "",
                messageType: lastMsg.messageType || lastMsg.type || "text",
                senderId: lastMsg.sender,
                encrypted: !!lastMsg.encrypted,
              }
            : undefined,
          lastMessageAt: lastMsg?.createdAt || conversation.createdAt,
          [`unreadCount.${String(a)}`]: unreadA,
          [`unreadCount.${String(b)}`]: unreadB,
        },
      }
    );

    migrated += 1;
    if (migrated % 25 === 0) console.log(`  ...${migrated}/${pairs.length}`);
  }

  console.log(`Migration complete. ${migrated} conversations backfilled.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
