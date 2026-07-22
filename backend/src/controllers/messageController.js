import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import UserLanguage from "../models/UserLanguage.js";
import { translateTo } from "../utils/translate.js";
import FriendRequest from "../models/FriendRequest.js";
import Friend from "../models/Friend.js";
import Group from "../models/Group.js";
import { isBlocked } from "./blockController.js";

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
    } = req.body;

    // Validate input - must have either receiver OR group
    if (!sender || (!receiver && !group) || (!text && !file)) {
      console.error("Missing required fields");
      return res.status(400).json({ message: "Sender, receiver/group, and content (text or file) are required" });
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
    }

    // Translation logic
    let targetLangCode = "en";
    let detectedLanguage = "auto";
    let translatedText = text;
    let groupTranslations = [];

    if (group && groupDoc && type === "text" && text) {
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
      text,
      type,
      file,
      originalText: type === "text" ? text : undefined,
      detectedLanguage,
      translatedText: group ? text : translatedText, // For groups, keep original in translatedText, use groupTranslations
      groupTranslations: group && groupTranslations.length > 0 ? groupTranslations : undefined,
      ...(clientMessageId && typeof clientMessageId === "string" ? { clientMessageId } : {}),
      ...(senderDeviceId && typeof senderDeviceId === "string" ? { senderDeviceId } : {}),
    });

    const savedMessage = await message.save();

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

/* GET CHAT HISTORY */
export const getMessages = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    // Validate input
    if (!user1 || !user2) {
      return res.status(400).json({ message: "Both user IDs are required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Fetch messages between the two users (1-on-1 only)
    let messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 },
      ],
      group: { $exists: false }, // Only 1-on-1 messages
    })
      .sort({ createdAt: 1 })
      .lean();

    // Exclude messages "deleted for me" for the current user
    const currentUserId = req.user ? String(req.user) : null;
    if (currentUserId) {
      messages = messages.filter(
        (m) =>
          !m.deletedFor ||
          !m.deletedFor.some((uid) => String(uid) === currentUserId)
      );
    }

    return res.json(messages);
  } catch (err) {
    console.error("GET MESSAGES ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET GROUP MESSAGES */
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

    // Fetch group messages
    let messages = await Message.find({
      group: groupId,
    })
      .populate("sender", "username avatar")
      .populate("groupTranslations.userId", "username")
      .sort({ createdAt: 1 })
      .lean();

    // Exclude messages "deleted for me" for the current user
    if (userId) {
      messages = messages.filter(
        (m) =>
          !m.deletedFor ||
          !m.deletedFor.some((uid) => String(uid) === String(userId))
      );
    }

    // For each message, add user-specific translation
    messages = messages.map((m) => {
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

    return res.json(messages);
  } catch (err) {
    console.error("GET GROUP MESSAGES ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
};

/* GET RECENT CHATS - Users with existing messages, sorted by last message time */
export const getRecentChats = async (req, res) => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Find all messages where currentUser is sender or receiver (1-on-1 only, no groups)
    const messages = await Message.find({
      $or: [{ sender: currentUser }, { receiver: currentUser }],
      group: { $exists: false }, // Only 1-on-1 messages
    })
      .select("sender receiver createdAt text messageType type")
      .sort({ createdAt: -1 })
      .lean();

    // Group by otherUserId and get the latest message for each conversation
    const chatMap = new Map();

    messages.forEach((msg) => {
      const senderStr = String(msg.sender);
      const receiverStr = String(msg.receiver);
      const currentStr = String(currentUser);

      // Determine the other user (must be a friend)
      const otherUserId = senderStr === currentStr ? receiverStr : senderStr;

      // Only keep the most recent message per conversation
      if (!chatMap.has(otherUserId)) {
        chatMap.set(otherUserId, {
          userId: otherUserId,
          lastMessage: msg.text || "",
          lastMessageType: msg.messageType || msg.type || "text",
          lastMessageTime: msg.createdAt,
        });
      } else {
        const existing = chatMap.get(otherUserId);
        if (new Date(msg.createdAt) > new Date(existing.lastMessageTime)) {
          existing.lastMessage = msg.text || "";
          existing.lastMessageType = msg.messageType || msg.type || "text";
          existing.lastMessageTime = msg.createdAt;
        }
      }
    });

    // Convert to array and sort by lastMessageTime DESC
    const recentChats = Array.from(chatMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    const userIds = recentChats.map((chat) => chat.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("username avatar email bio")
      .lean();

    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(String(u._id), u);
    });

    const result = recentChats.map((chat) => {
      const user = userMap.get(chat.userId);

      if (!user) {
        return {
          _id: chat.userId,
          username: "Deleted User",
          avatar: "/default-avatar.png",
          email: "",
          bio: "",
          lastMessage: chat.lastMessage,
          lastMessageType: chat.lastMessageType,
          lastMessageTime: chat.lastMessageTime,
        };
      }

      return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
        bio: user.bio,
        lastMessage: chat.lastMessage,
        lastMessageType: chat.lastMessageType,
        lastMessageTime: chat.lastMessageTime,
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