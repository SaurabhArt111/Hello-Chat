import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import UserLanguage from "../models/UserLanguage.js";
import { translateTo } from "../utils/translate.js";
import FriendRequest from "../models/FriendRequest.js";
import Friend from "../models/Friend.js";
import Group from "../models/Group.js";
import Conversation from "../models/Conversation.js";
import { isBlocked } from "./blockController.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * Bump the denormalized conversation preview + unread counter. Called after
 * every successful 1:1 message save so the chat list never has to scan the
 * Message collection (see models/Conversation.js).
 */
async function touchConversationOnNewMessage(conversationId, message, receiverId) {
  try {
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessage: {
            text: message.encrypted ? "" : message.text || "",
            messageType: message.messageType || message.type || "text",
            senderId: message.sender,
            encrypted: !!message.encrypted,
          },
          lastMessageAt: message.createdAt || new Date(),
        },
        $inc: { [`unreadCount.${String(receiverId)}`]: 1 },
      }
    );
  } catch (err) {
    console.error("touchConversationOnNewMessage error:", err);
  }
}

const langMap = {
  English: "en",
  Hindi: "hi",
  Gujarati: "gu",
  Marathi: "mr",
  Bengali: "bn",
  Odia: "or",
  Spanish: "es",
  French: "fr",
  German: "de",
};

/* SAVE MESSAGE + TRANSLATE */
export const saveMessage = async (req, res) => {
  try {
    const {
      sender,
      receiver,
      group,
      text,
      type = "text",
      file = null,
      clientMessageId,
      senderDeviceId,
      // E2EE (1:1 only): when the client sends `encrypted: true`, `text` is
      // ignored/blank and the real content is ciphertext+nonce. The server
      // never sees plaintext for these messages, so it cannot translate
      // them - see Conversation.e2eeEnabled.
      encrypted,
      ciphertext,
      nonce,
      senderE2eePublicKey,
    } = req.body;

    // Validate input - must have either receiver OR group
    const hasContent = !!text || !!file || (encrypted && ciphertext);
    if (!sender || (!receiver && !group) || !hasContent) {
      console.error("Missing required fields");
      return res.status(400).json({ message: "Sender, receiver/group, and content (text, file, or ciphertext) are required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(sender)) {
      console.error("Invalid ObjectId format");
      return res.status(400).json({ message: "Invalid sender ID format" });
    }

    // If clientMessageId is provided, make send idempotent for retries.
    // This prevents duplicate delivery when the client retries after network errors/timeouts.
    if (clientMessageId && typeof clientMessageId === "string") {
      const existing = await Message.findOne({
        sender: new mongoose.Types.ObjectId(sender),
        clientMessageId,
      }).lean();
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    let groupDoc = null;
    let receiverUser = null;
    let conversation = null;

    // Handle group messages
    if (group) {
      if (!mongoose.Types.ObjectId.isValid(group)) {
        return res.status(400).json({ message: "Invalid group ID format" });
      }

      groupDoc = await Group.findOne({
        _id: group,
        "members.user": sender,
        isActive: true,
      }).lean();

      if (!groupDoc) {
        return res.status(403).json({ message: "You are not a member of this group or group is inactive" });
      }

      // Populate group members for translation
      await Group.populate(groupDoc, { path: "members.user", select: "username avatar preferredLanguage" });
    } else {
      // Handle 1-on-1 messages
      if (!mongoose.Types.ObjectId.isValid(receiver)) {
        console.error("Invalid ObjectId format");
        return res.status(400).json({ message: "Invalid receiver ID format" });
      }

      // Check if sender and receiver are friends
      const friendship = await FriendRequest.findOne({
        $or: [
          { sender: sender, receiver: receiver },
          { sender: receiver, receiver: sender },
        ],
        status: "accepted",
      }).lean();

      if (!friendship) {
        console.error("Friendship not found");
        return res.status(403).json({ message: "You can only message friends" });
      }

      // Receiver has blocked sender → cannot send
      if (await isBlocked(receiver, sender)) {
        return res.status(403).json({ message: "You cannot send messages to this user" });
      }

      receiverUser = await User.findById(receiver).lean();
      if (!receiverUser) {
        console.error("Receiver user not found");
        return res.status(404).json({ message: "Receiver not found" });
      }

      conversation = await Conversation.findOrCreateDirect(sender, receiver);
      if (encrypted && !conversation.e2eeEnabled) {
        await Conversation.updateOne({ _id: conversation._id }, { $set: { e2eeEnabled: true } });
      }
    }

    // Translation logic - skipped entirely for E2EE messages, since the
    // server never has plaintext to translate (that's the point of E2EE).
    let targetLangCode = "en";
    let detectedLanguage = "auto";
    let translatedText = text;
    let groupTranslations = [];

    if (encrypted) {
      detectedLanguage = undefined;
      translatedText = undefined;
    } else if (group && groupDoc && type === "text" && text) {
      // GROUP MESSAGE: Translate for each member
      try {
        // Detect language once
        const detectResult = await translateTo(text, "en"); // Use English to detect
        detectedLanguage = detectResult.detectedLanguage || "auto";

        // Get all members except sender
        const membersToTranslate = groupDoc.members.filter(
          (m) => String(m.user._id || m.user) !== String(sender)
        );

        // Translate for each member based on their preferred language
        for (const member of membersToTranslate) {
          const memberId = String(member.user._id || member.user);
          const memberUser = member.user;

          // Get preferred language
          const userLang = await UserLanguage.findOne({ userId: memberId }).lean();
          let memberTargetLang = "en";
          
          if (userLang?.preferredLanguage) {
            memberTargetLang = userLang.preferredLanguage;
          } else if (memberUser?.preferredLanguage) {
            memberTargetLang = langMap[memberUser.preferredLanguage] || "en";
          }

          // If same language, no translation needed
          if (memberTargetLang === detectedLanguage || memberTargetLang === "auto") {
            groupTranslations.push({
              userId: new mongoose.Types.ObjectId(memberId),
              translatedText: text,
            });
          } else {
            // Translate
            try {
              const result = await translateTo(text, memberTargetLang);
              groupTranslations.push({
                userId: new mongoose.Types.ObjectId(memberId),
                translatedText: result.translatedText || text,
              });
            } catch (err) {
              console.error(`Translation error for user ${memberId}:`, err.message);
              groupTranslations.push({
                userId: new mongoose.Types.ObjectId(memberId),
                translatedText: text,
              });
            }
          }
        }
      } catch (err) {
        console.error("Group translation error:", err.message);
        detectedLanguage = "en";
      }
    } else if (!group && receiverUser) {
      // 1-ON-1 MESSAGE: Translate for receiver
      const userLang = await UserLanguage.findOne({ userId: receiver }).lean();
      if (userLang?.preferredLanguage) {
        targetLangCode = userLang.preferredLanguage;
      } else if (receiverUser.preferredLanguage) {
        targetLangCode = langMap[receiverUser.preferredLanguage] || "en";
      }

      if (type === "text" && text) {
        try {
          const result = await translateTo(text, targetLangCode);
          detectedLanguage = result.detectedLanguage;
          translatedText = result.translatedText;
        } catch (err) {
          console.error("Translation error:", err.message);
          detectedLanguage = "en";
          translatedText = text;
        }
      }
    }

    // Create and save message
    const message = new Message({
      sender: new mongoose.Types.ObjectId(sender),
      receiver: receiver ? new mongoose.Types.ObjectId(receiver) : undefined,
      group: group ? new mongoose.Types.ObjectId(group) : undefined,
      conversationId: conversation ? conversation._id : undefined,
      text: encrypted ? "" : text,
      type,
      file,
      encrypted: !!encrypted,
      ciphertext: encrypted ? ciphertext : undefined,
      nonce: encrypted ? nonce : undefined,
      senderE2eePublicKey: encrypted ? senderE2eePublicKey : undefined,
      originalText: !encrypted && type === "text" ? text : undefined,
      detectedLanguage,
      translatedText: encrypted ? undefined : group ? text : translatedText,
      groupTranslations: group && groupTranslations.length > 0 ? groupTranslations : undefined,
      ...(clientMessageId && typeof clientMessageId === "string" ? { clientMessageId } : {}),
      ...(senderDeviceId && typeof senderDeviceId === "string" ? { senderDeviceId } : {}),
    });

    const savedMessage = await message.save();

    if (conversation) {
      await touchConversationOnNewMessage(conversation._id, savedMessage, receiver);
    }

    return res.status(201).json(savedMessage);
  } catch (err) {
    console.error("SAVE MESSAGE ERROR:", err);
    if (err.name === "ValidationError") {
      console.error("Validation errors:", err.errors);
      return res.status(400).json({
        error: "Validation failed",
        details: err.errors,
      });
    }
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/**
 * GET /api/messages/sync?since=<ISO|ms>
 * Returns messages created after "since" for:
 * - 1:1 chats where user is sender or receiver
 * - groups where user is a member
 *
 * This is used by the client on reconnect/app reopen to fetch missed messages
 * and merge locally without a full refresh.
 */
export const syncMessages = async (req, res) => {
  try {
    const userId = req.user;
    const sinceRaw = req.query.since;
    const limitRaw = req.query.limit;

    if (!sinceRaw) {
      return res.status(400).json({ message: "since query param is required" });
    }

    const sinceDate =
      typeof sinceRaw === "string" && /^\d+$/.test(sinceRaw)
        ? new Date(Number(sinceRaw))
        : new Date(String(sinceRaw));

    if (Number.isNaN(sinceDate.getTime())) {
      return res.status(400).json({ message: "Invalid since timestamp" });
    }

    const limit = Math.min(Math.max(parseInt(String(limitRaw || "500"), 10) || 500, 1), 2000);

    const groups = await Group.find(
      { "members.user": userId, isActive: true },
      { _id: 1 }
    ).lean();
    const groupIds = groups.map((g) => g._id);

    let messages = await Message.find({
      createdAt: { $gt: sinceDate },
      $or: [
        { sender: userId },
        { receiver: userId },
        ...(groupIds.length ? [{ group: { $in: groupIds } }] : []),
      ],
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate("sender", "username avatar")
      .lean();

    // Exclude messages "deleted for me"
    const currentUserId = userId ? String(userId) : null;
    if (currentUserId) {
      messages = messages.filter(
        (m) =>
          !m.deletedFor || !m.deletedFor.some((uid) => String(uid) === currentUserId)
      );
    }

    // For group messages, attach user-specific translatedText (same behavior as getGroupMessages)
    messages = messages.map((m) => {
      if (!m.group) return m;
      const isOwn = String(m.sender?._id || m.sender) === String(userId);
      if (isOwn) {
        return { ...m, translatedText: m.originalText || m.text };
      }
      if (m.groupTranslations && m.groupTranslations.length > 0) {
        const userTranslation = m.groupTranslations.find(
          (t) => String(t.userId?._id || t.userId) === String(userId)
        );
        if (userTranslation) {
          return { ...m, translatedText: userTranslation.translatedText || m.text };
        }
      }
      return { ...m, translatedText: m.text };
    });

    return res.json({
      since: sinceDate.toISOString(),
      messages,
    });
  } catch (err) {
    console.error("SYNC MESSAGES ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/**
 * GET CHAT HISTORY - cursor-paginated.
 *
 * Previously this loaded the ENTIRE 1:1 message history in one query with
 * no limit at all - fine for a demo, but it means every chat open gets
 * slower forever and eventually falls over once a conversation has a few
 * thousand messages. Now it returns the most recent `limit` messages (or
 * the `limit` messages immediately before the `before` cursor for
 * "load older" / infinite scroll), using the {conversationId, createdAt}
 * index so it stays fast regardless of how long the conversation is.
 *
 * Response shape: { messages: [...oldest→newest], hasMore, oldestCursor }
 */
export const getMessages = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const currentUserId = req.user ? String(req.user) : null;

    if (!user1 || !user2) {
      return res.status(400).json({ message: "Both user IDs are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );
    const before = req.query.before; // ISO date or message _id timestamp - fetch messages older than this

    const conversation = await Conversation.findOne({
      participants: { $all: [user1, user2], $size: 2 },
    })
      .select("_id")
      .lean();

    let query;
    if (conversation) {
      query = { conversationId: conversation._id };
    } else {
      // Conversation not created yet (e.g. pre-migration data, or no
      // messages sent yet) - fall back to the legacy $or lookup.
      query = {
        $or: [
          { sender: user1, receiver: user2 },
          { sender: user2, receiver: user1 },
        ],
        group: { $exists: false },
      };
    }

    if (before) {
      const beforeDate = /^\d+$/.test(String(before)) ? new Date(Number(before)) : new Date(String(before));
      if (!Number.isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch newest-first (indexed), then reverse to oldest→newest for the UI.
    let page = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // fetch one extra to know if there's more
      .lean();

    const hasMore = page.length > limit;
    if (hasMore) page = page.slice(0, limit);
    page.reverse();

    // Exclude messages "deleted for me" for the current user
    if (currentUserId) {
      page = page.filter(
        (m) => !m.deletedFor || !m.deletedFor.some((uid) => String(uid) === currentUserId)
      );
    }

    return res.json({
      messages: page,
      hasMore,
      oldestCursor: page.length ? page[0].createdAt : null,
    });
  } catch (err) {
    console.error("GET MESSAGES ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET GROUP MESSAGES - cursor-paginated (see getMessages for why) */
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user;

    // Validate input
    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID format" });
    }

    // Check if user is a member of the group
    const group = await Group.findOne({
      _id: groupId,
      "members.user": userId,
      isActive: true,
    }).lean();

    if (!group) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );
    const before = req.query.before;

    const query = { group: groupId };
    if (before) {
      const beforeDate = /^\d+$/.test(String(before)) ? new Date(Number(before)) : new Date(String(before));
      if (!Number.isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch group messages (newest-first via the {group, createdAt} index, then reverse)
    let page = await Message.find(query)
      .populate("sender", "username avatar")
      .populate("groupTranslations.userId", "username")
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = page.length > limit;
    if (hasMore) page = page.slice(0, limit);
    page.reverse();

    // Exclude messages "deleted for me" for the current user
    if (userId) {
      page = page.filter(
        (m) =>
          !m.deletedFor ||
          !m.deletedFor.some((uid) => String(uid) === String(userId))
      );
    }

    // For each message, add user-specific translation
    page = page.map((m) => {
      const isOwn = String(m.sender._id || m.sender) === String(userId);

      // For sender, always show original
      if (isOwn) {
        return {
          ...m,
          translatedText: m.originalText || m.text,
        };
      }

      // For receiver, find their translation in groupTranslations
      if (m.groupTranslations && m.groupTranslations.length > 0) {
        const userTranslation = m.groupTranslations.find(
          (t) => String(t.userId._id || t.userId) === String(userId)
        );
        
        if (userTranslation) {
          return {
            ...m,
            translatedText: userTranslation.translatedText || m.text,
          };
        }
      }

      // Fallback to original text
      return {
        ...m,
        translatedText: m.text,
      };
    });

    return res.json({
      messages: page,
      hasMore,
      oldestCursor: page.length ? page[0].createdAt : null,
    });
  } catch (err) {
    console.error("GET GROUP MESSAGES ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET RECENT CHATS - Users with existing conversations, sorted by last activity */
export const getRecentChats = async (req, res) => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Single indexed query against the denormalized Conversation collection
    // (see models/Conversation.js) instead of scanning every message the
    // user has ever sent/received and grouping in JS.
    const conversations = await Conversation.find({ participants: currentUser })
      .sort({ lastMessageAt: -1 })
      .limit(200)
      .lean();

    const otherUserIds = conversations.map(
      (c) => c.participants.find((p) => String(p) !== String(currentUser)) || c.participants[0]
    );

    const users = await User.find({ _id: { $in: otherUserIds } })
      .select("username avatar email bio")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const result = conversations.map((c) => {
      const otherId = String(
        c.participants.find((p) => String(p) !== String(currentUser)) || c.participants[0]
      );
      const user = userMap.get(otherId);
      const unread = (c.unreadCount && (c.unreadCount.get ? c.unreadCount.get(String(currentUser)) : c.unreadCount[String(currentUser)])) || 0;

      const base = {
        conversationId: String(c._id),
        lastMessage: c.lastMessage?.encrypted ? "🔒 Encrypted message" : c.lastMessage?.text || "",
        lastMessageType: c.lastMessage?.messageType || "text",
        lastMessageTime: c.lastMessageAt,
        unreadCount: unread,
      };

      if (!user) {
        return {
          _id: otherId,
          username: "Deleted User",
          avatar: "/default-avatar.png",
          email: "",
          bio: "",
          ...base,
        };
      }

      return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
        bio: user.bio,
        ...base,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("GET RECENT CHATS ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};