import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import ChatItem from "../components/chat/ChatItem";
import SidebarIcons from "../components/layout/SidebarIcons";
import MessageBubble from "../components/chat/MessageBubble";
import TranslatedMessageBubble from "../components/chat/TranslatedMessageBubble";
import VoiceMessageBubble from "../components/chat/VoiceMessageBubble";
import MessageInput from "../components/chat/MessageInput";
import Avatar from "../components/common/Avatar";
import ChatHeader from "../components/chat/ChatHeader";
import DateSeparator, { NewMessagesSeparator } from "../components/chat/DateSeparator";

// Lazy-loaded heavy side panels & modals — only fetched when user opens them
const ProfilePanel = React.lazy(() => import("../components/profile/ProfilePanel"));
const SettingsPanel = React.lazy(() => import("../components/settings/SettingsPanel"));
const UsersPanel = React.lazy(() => import("../components/users/UsersPanel"));
const RequestsPanel = React.lazy(() => import("../components/notifications/RequestsPanel"));
const CallsPanel = React.lazy(() => import("../components/calls/CallsPanel"));
const ForwardModal = React.lazy(() => import("../components/chat/ForwardModal"));
const CreateGroupModal = React.lazy(() => import("../components/groups/CreateGroupModal"));
const GroupProfilePanel = React.lazy(() => import("../components/groups/GroupProfilePanel"));
const ScheduleMessageModal = React.lazy(() => import("../components/chat/ScheduleMessageModal"));

import socket from "../socket";
import { FiArrowDown } from "react-icons/fi";
import {
  saveMessage,
  getMessages,
  getGroupMessages,
  markSeen,
  editMessage,
  syncMessages,
  getRecentChats,
} from "../api/messages";
import { amBlocking, checkBlocked, blockUser, unblockUser } from "../api/block";
import { playSendSound } from "../utils/messageSound";
import { translateText } from "../utils/translateService";
import { useLanguage } from "../context/LanguageContext";
import { getFriends } from "../api/friends";
import { getContacts } from "../api/users";
import axios from "../api/axios";
import {
  X,
  MessageCircle,
  Bell,
  UserPlus,
  Phone,
  Settings,
  User,
} from "lucide-react";
import { useToastContext } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { getUserGroups } from "../api/groups";
import { cancelScheduledMessage } from "../api/scheduledMessages";
import { Users as UsersIcon, Plus } from "lucide-react";
import { getDeviceId } from "../realtime/deviceId";
import {
  loadConversationCache,
  saveConversationCache,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from "../realtime/cache";
import { enqueueOutbox, listOutbox, removeOutbox } from "../realtime/outbox";

/* Small spinner for lazy-loaded panels */
const PanelLoader = () => (
  <div className="flex items-center justify-center h-full w-full py-12">
    <svg className="animate-spin h-7 w-7 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

const Home = () => {
  const ACTIVE_CHAT_KEY = "activeChat:v1";
  const [activeChat, setActiveChat] = useState(null);
  const [friends, setFriends] = useState([]); // Keep for backward compatibility, but will use recentChats/contacts instead
  const [recentChats, setRecentChats] = useState([]); // Users with messages for "chats" view
  const [contacts, setContacts] = useState([]); // Accepted friends for "contacts" view
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [activePanel, setActivePanel] = useState(null);
  const [activeView, setActiveView] = useState("chats"); // chats, contacts, calls
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [scheduleMessageModalOpen, setScheduleMessageModalOpen] = useState(false);
  const [scheduleText, setScheduleText] = useState("");
  const [messages, setMessages] = useState({});
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set()); // Set for O(1) lookups
  const [sidebarOpen, setSidebarOpen] = useState(true); // icon-only when false
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRecentChats, setLoadingRecentChats] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [friendsLoadError, setFriendsLoadError] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const toast = useToastContext();

  const messagesContainerRef = useRef(null);
  const [userStatus, setUserStatus] = useState({});
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [profilePanelShowSelf, setProfilePanelShowSelf] = useState(true);
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const [highlightQuery, setHighlightQuery] = useState("");
  const { preferredLanguage } = useLanguage();
  const preferredLanguageRef = useRef(preferredLanguage);
  useEffect(() => { preferredLanguageRef.current = preferredLanguage; }, [preferredLanguage]);
  const restoredActiveChatRef = useRef(false);

  // Socket connection status
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Persist message state to IndexedDB in a debounced way (all conversations).
  const cacheFlushTimerRef = useRef(null);
  const pendingCacheRef = useRef(new Map()); // conversationId -> messages[]
  const prevMessagesRef = useRef({});

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [floatingDateLabel, setFloatingDateLabel] = useState("");
  const [unreadSeparatorMessageId, setUnreadSeparatorMessageId] = useState(null);
  const [mobileNavPage, setMobileNavPage] = useState(0);
  const [mobileNavPages, setMobileNavPages] = useState(1);
  const mobileNavScrollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const [currentScrollTop, setCurrentScrollTop] = useState(0);
  const scrollRafRef = useRef(null);
  const lastActiveChatIdRef = useRef(null);

  useEffect(() => {
    const updateMobileNavPagination = () => {
      const el = mobileNavScrollRef.current;
      if (!el) return;
      const pageWidth = Math.max(el.clientWidth, 1);
      const total = Math.max(1, Math.ceil(el.scrollWidth / pageWidth));
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const progress = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
      const page = Math.round(progress * (total - 1));
      setMobileNavPages(total);
      setMobileNavPage(page);
    };

    updateMobileNavPagination();
    window.addEventListener("resize", updateMobileNavPagination);
    return () => window.removeEventListener("resize", updateMobileNavPagination);
  }, []);

  const queueConversationCacheWrite = useCallback((conversationId, list) => {
    if (!conversationId || !Array.isArray(list)) return;
    pendingCacheRef.current.set(String(conversationId), list);
    if (cacheFlushTimerRef.current) return;
    cacheFlushTimerRef.current = setTimeout(async () => {
      const entries = Array.from(pendingCacheRef.current.entries());
      pendingCacheRef.current.clear();
      cacheFlushTimerRef.current = null;
      await Promise.all(entries.map(([cid, msgs]) => saveConversationCache(cid, msgs)));
    }, 300);
  }, []);

  useEffect(() => {
    const prev = prevMessagesRef.current || {};
    Object.keys(messages || {}).forEach((cid) => {
      if (messages[cid] && messages[cid] !== prev[cid]) {
        queueConversationCacheWrite(cid, messages[cid]);
      }
    });
    prevMessagesRef.current = messages;
  }, [messages, queueConversationCacheWrite]);

  const mergeMessageLists = useCallback((a, b) => {
    const map = new Map();
    const put = (m) => {
      if (!m) return;
      const key =
        (m._id != null && String(m._id)) ||
        (m.clientMessageId != null && String(m.clientMessageId)) ||
        null;
      if (!key) return;
      map.set(key, m);
    };
    (Array.isArray(a) ? a : []).forEach(put);
    (Array.isArray(b) ? b : []).forEach(put);
    const merged = Array.from(map.values());
    merged.sort((x, y) => {
      const ax = x.createdAt ? new Date(x.createdAt).getTime() : 0;
      const ay = y.createdAt ? new Date(y.createdAt).getTime() : 0;
      return ax - ay;
    });
    return merged;
  }, []);

  const generateClientMessageId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }, []);

  const scrollToMessageId = useCallback((id) => {
    if (!id || !messagesContainerRef.current) return;
    const el = messagesContainerRef.current.querySelector(`[data-message-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleSearchSelectMessage = useCallback((msg, query) => {
    if (msg?._id) {
      scrollToMessageId(msg._id);
      setHighlightMessageId(msg._id);
      setHighlightQuery(query || "");
      setTimeout(() => {
        setHighlightMessageId(null);
        setHighlightQuery("");
      }, 3000);
    }
  }, [scrollToMessageId]);

  // ----- Date separator helpers -----
  const getDateKey = (isoOrDate) => {
    if (!isoOrDate) return "";
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const formatDateLabel = (isoOrDate) => {
    if (!isoOrDate) return "";
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const that = new Date(d);
    that.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - that.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleScrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
    isAtBottomRef.current = true;
    setShowScrollToBottom(false);
    setUnreadSeparatorMessageId(null);
  }, []);

  /* LOAD RECENT CHATS - Users with existing messages */
  const loadRecentChats = async () => {
    setLoadingRecentChats(true);
    try {
      const res = await getRecentChats();
      setRecentChats(res.data || []);
      // Also update friends for backward compatibility
      setFriends(res.data || []);
    } catch (err) {
      console.error("Failed to load recent chats:", err);
      setRecentChats([]);
      setFriends([]);
    } finally {
      setLoadingRecentChats(false);
    }
  };

  /* LOAD CONTACTS - Only accepted friends */
  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await getContacts();
      setContacts(res.data || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  /* LOAD FRIENDS - Keep for backward compatibility, but prefer recentChats/contacts */
  const loadFriends = async () => {
    setLoadingFriends(true);
    setFriendsLoadError(false);
    try {
      // Load recent chats by default (for chats view)
      if (activeView === "chats") {
        await loadRecentChats();
      } else if (activeView === "contacts") {
        await loadContacts();
      } else {
        const res = await getFriends();
        setFriends(res.data);
      }
    } catch (err) {
      setFriendsLoadError(true);
      toast.error("Failed to load friends. Please try again.");
      console.error(err);
    } finally {
      setLoadingFriends(false);
    }
  };

  /* LOAD GROUPS */
  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await getUserGroups();
      const nextGroups = res.data.groups || [];
      setGroups(nextGroups);

      // If a group chat is currently open, refresh it so header/sidebar reflect updates (e.g., groupLogo)
      setActiveChat((prev) => {
        if (!prev?.isGroup) return prev;
        const updated = nextGroups.find((g) => String(g._id) === String(prev._id));
        return updated ? { ...prev, ...updated, isGroup: true } : prev;
      });
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    loadRecentChats();
    loadContacts();
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload data when switching views
  useEffect(() => {
    if (activeView === "chats") {
      loadRecentChats();
    } else if (activeView === "contacts") {
      loadContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // If no chat is selected, keep the sidebar open (WhatsApp-like).
  useEffect(() => {
    if (!activeChat?._id) setSidebarOpen(true);
  }, [activeChat?._id]);

  // Persist active chat so refresh/navigation returns to it
  useEffect(() => {
    try {
      if (!activeChat?._id) {
        // On initial mount/refresh, activeChat starts as null; don't erase the saved chat
        // before we get a chance to restore it.
        if (restoredActiveChatRef.current) {
          localStorage.removeItem(ACTIVE_CHAT_KEY);
        }
        return;
      }
      localStorage.setItem(
        ACTIVE_CHAT_KEY,
        JSON.stringify({
          id: String(activeChat._id),
          isGroup: !!activeChat.isGroup,
          savedAt: Date.now(),
        })
      );
    } catch {
      // ignore
    }
  }, [activeChat]);

  // Restore active chat once friends/groups are loaded (supports refresh + navigating away/back)
  useEffect(() => {
    if (restoredActiveChatRef.current) return;
    if (activeChat) {
      restoredActiveChatRef.current = true;
      return;
    }
    // wait for initial loads to finish
    if (loadingFriends || loadingGroups) return;

    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(ACTIVE_CHAT_KEY) || "null");
    } catch {
      stored = null;
    }
    const id = stored?.id ? String(stored.id) : null;
    if (!id) {
      restoredActiveChatRef.current = true;
      return;
    }

    // Prefer group restore if stored says group; otherwise friend
    if (stored?.isGroup) {
      const g = (groups || []).find((x) => String(x._id) === id);
      if (g) {
        setActiveView("chats");
        setActiveChat({ ...g, isGroup: true });
      }
      // If group not found (e.g. removed), stop trying to restore.
      restoredActiveChatRef.current = true;
      return;
    }

    const f = (friends || []).find((x) => String(x._id) === id);
    if (f) {
      setActiveView("chats");
      setActiveChat(f);
    }
    restoredActiveChatRef.current = true;
  }, [friends, groups, activeChat, loadingFriends, loadingGroups]);

  /* JOIN SOCKET */
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user?.id || user?._id;
    const token = localStorage.getItem("token");
    if (!userId) return;

    const deviceId = getDeviceId();
    socket.auth = { token, userId: String(userId), deviceId };

    const joinPayload = { userId: String(userId), deviceId };
    const doJoin = () => socket.emit("join", joinPayload);

    socket.on("connect", doJoin);

    // Ensure a single socket instance is connected for this app session.
    if (!socket.connected) socket.connect();
    if (socket.connected) doJoin();

    return () => {
      socket.off("connect", doJoin);
    };
  }, []);

  /* OUTBOX RETRY + BACKGROUND SYNC (on reconnect) */
  const flushOutbox = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const myId = user?.id || user?._id;
    if (!myId) return;

    const items = await listOutbox();
    if (!items.length) return;

    for (const item of items) {
      try {
        // Re-send idempotently. Backend will return existing message if already saved.
        const res = await saveMessage({
          sender: item.sender,
          receiver: item.receiver,
          group: item.group,
          text: item.text,
          type: item.type || "text",
          clientMessageId: item.clientMessageId,
          senderDeviceId: item.senderDeviceId,
        });

        const saved = res?.data;
        if (!saved?._id) continue;

        const conversationId = item.group ? String(item.group) : String(item.receiver);
        const time = new Date(saved.createdAt || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        setMessages((prev) => {
          const list = prev[conversationId] || [];
          const next = list.map((m) => {
            if (m?.clientMessageId && String(m.clientMessageId) === String(item.clientMessageId)) {
              return {
                ...m,
                _id: String(saved._id),
                status: saved.status ?? "sent",
                createdAt: saved.createdAt ?? m.createdAt,
                text: saved.originalText ?? saved.text ?? m.text,
                originalText: saved.originalText ?? m.originalText,
                translatedText: saved.translatedText ?? m.translatedText,
              };
            }
            return m;
          });
          return { ...prev, [conversationId]: next };
        });

        await removeOutbox(item.clientMessageId);

        socket.emit("sendMessage", {
          senderId: String(myId),
          receiverId: item.group ? undefined : String(item.receiver),
          groupId: item.group ? String(item.group) : undefined,
          message: saved,
        });
      } catch (e) {
        // leave in outbox; we'll retry next time
        console.error("Outbox resend failed:", e);
      }
    }
  }, []);

  const runBackgroundSync = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const myId = user?.id || user?._id;
    if (!myId) return;

    const last = await getLastSyncTimestamp(myId);
    const sinceMs =
      last != null ? last : Date.now() - 7 * 24 * 60 * 60 * 1000; // first run: 7d window

    try {
      const res = await syncMessages(sinceMs, 1000);
      const serverMessages = res?.data?.messages || [];
      if (!Array.isArray(serverMessages) || serverMessages.length === 0) {
        await setLastSyncTimestamp(myId, Date.now());
        return;
      }

      const byConversation = {};
      let maxTs = sinceMs;

      for (const m of serverMessages) {
        const sender = String(m.sender?._id || m.sender || "");
        const receiver = m.receiver != null ? String(m.receiver?._id || m.receiver) : null;
        const group = m.group != null ? String(m.group?._id || m.group) : null;
        const createdAt = m.createdAt || new Date().toISOString();
        const ts = new Date(createdAt).getTime();
        if (!Number.isNaN(ts)) maxTs = Math.max(maxTs, ts);

        const isOwn = sender === String(myId);
        const conversationId = group
          ? group
          : isOwn
            ? String(receiver)
            : String(sender);

        const msgType = m.messageType || m.type || "text";
        const fileUrl = m.fileUrl || m.file || m.audioUrl || null;
        const isMedia = ["image", "video", "file", "link", "voice"].includes(msgType);

        const time = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const item = isMedia
          ? {
            _id: m._id != null ? String(m._id) : m._id,
            clientMessageId: m.clientMessageId,
            type: msgType,
            file: fileUrl,
            audioUrl: m.audioUrl || m.fileUrl || m.file,
            duration: m.duration,
            text: m.text || m.fileName || "",
            isOwn,
            time,
            createdAt,
            status: m.status ?? (isOwn ? "sent" : "sent"),
            reactions: m.reactions || [],
            forwarded: m.forwarded,
            deletedForEveryone: m.deletedForEveryone,
          }
          : {
            _id: m._id != null ? String(m._id) : m._id,
            clientMessageId: m.clientMessageId,
            type: "text",
            text: isOwn ? (m.originalText ?? m.text ?? "") : (m.translatedText ?? m.text ?? ""),
            originalText: m.originalText ?? m.text ?? "",
            translatedText: m.translatedText ?? m.text ?? "",
            detectedLanguage: m.detectedLanguage,
            isOwn,
            time,
            createdAt,
            status: m.status ?? (isOwn ? "sent" : "sent"),
            reactions: m.reactions || [],
            forwarded: m.forwarded,
            deletedForEveryone: m.deletedForEveryone,
            edited: !!m.edited,
            editedAt: m.editedAt ?? null,
          };

        if (!byConversation[conversationId]) byConversation[conversationId] = [];
        byConversation[conversationId].push(item);
      }

      setMessages((prev) => {
        const next = { ...prev };
        Object.keys(byConversation).forEach((cid) => {
          next[cid] = mergeMessageLists(prev[cid] || [], byConversation[cid]);
        });
        return next;
      });

      await setLastSyncTimestamp(myId, maxTs);
    } catch (e) {
      console.error("Background sync failed:", e);
    }
  }, [mergeMessageLists]);

  useEffect(() => {
    const onConnect = () => {
      flushOutbox();
      runBackgroundSync();
    };
    socket.on("connect", onConnect);
    window.addEventListener("online", onConnect);
    return () => {
      socket.off("connect", onConnect);
      window.removeEventListener("online", onConnect);
    };
  }, [flushOutbox, runBackgroundSync]);

  /* RECEIVE MEDIA / NEW MESSAGES (media path) */
  useEffect(() => {
    const handler = (data) => {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const userId = user?.id || user?._id;
      if (!userId) return;

      const { senderId, receiverId, messageType, fileUrl, fileName, text, createdAt, _id, duration, audioUrl } =
        data;

      if (String(receiverId) !== String(userId)) return;
      const convoId = String(senderId);

      const isMedia = ["image", "video", "file", "link", "voice"].includes(
        messageType
      );

      const messageObj = isMedia
        ? {
          _id,
          type: messageType,
          file: fileUrl || audioUrl,
          audioUrl: audioUrl || fileUrl,
          duration,
          text: text || fileName || "",
          isOwn: false,
          time: new Date(createdAt || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }
        : {
          text: text,
          isOwn: false,
          time: new Date(createdAt || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

      setMessages((prev) => ({
        ...prev,
        [convoId]: (() => {
          const list = prev[convoId] || [];
          const mid = _id != null ? String(_id) : null;
          if (mid && list.some((m) => m?._id != null && String(m._id) === mid)) return list;
          return [...list, { ...messageObj, _id: mid || messageObj._id, createdAt: createdAt || new Date().toISOString() }];
        })(),
      }));
    };

    socket.on("new_message", handler);

    return () => {
      socket.off("new_message", handler);
    };
  }, []);

  /* RECEIVE MESSAGE (socket.io): use originalText/translatedText from server when present (no repeated API calls) */
  useEffect(() => {
    // Guard against duplicate processing: server emits both "receiveMessage" + "receive_message"
    // for every message. We track recently-processed messages to skip the duplicate.
    const recentlyProcessed = new Set();

    const handler = async ({ senderId, receiverId, groupId, message }) => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;

      // Dedupe: build a unique key from senderId + message._id (or text hash for fallback)
      const mid = message?._id ?? message?.clientMessageId ?? null;
      const dedupeKey = mid ? `${senderId}:${mid}` : null;
      if (dedupeKey) {
        if (recentlyProcessed.has(dedupeKey)) return; // already handled from the other event name
        recentlyProcessed.add(dedupeKey);
        setTimeout(() => recentlyProcessed.delete(dedupeKey), 2000);
      }

      const userId = user?.id || user?._id;
      // 1-on-1: if server echoes back to sender, we want to append to the receiver conversation.
      const conversationId = groupId
        ? String(groupId)
        : String(senderId) === String(userId)
          ? String(receiverId)
          : String(senderId);

      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const isFullMessage =
        message &&
        typeof message === "object" &&
        (message.originalText != null || message.translatedText != null || message.text != null);

      if (isFullMessage) {
        const m = message;
        const isOwn = String(m.sender?._id || m.sender || senderId) === String(userId);
        const mid = m._id != null ? String(m._id) : null;
        const cmid = m.clientMessageId != null ? String(m.clientMessageId) : null;
        const createdAtIso = m.createdAt || new Date().toISOString();
        setMessages((prev) => {
          const list = prev[conversationId] || [];
          // If this message already exists (e.g., scheduled placeholder), update it in-place.
          if (mid && list.some((x) => x?._id != null && String(x._id) === mid)) {
            const next = list.map((x) => {
              if (!x?._id || String(x._id) !== mid) return x;
              return {
                ...x,
                text: isOwn ? (m.originalText ?? m.text ?? x.text) : (m.translatedText ?? m.text ?? x.text),
                originalText: m.originalText ?? m.text ?? x.originalText,
                translatedText: m.translatedText ?? m.text ?? x.translatedText,
                detectedLanguage: m.detectedLanguage ?? x.detectedLanguage,
                createdAt: createdAtIso,
                time,
                status: m.status ?? x.status ?? "sent",
                type: m.messageType || m.type || x.type || "text",
                file: m.fileUrl || m.file || m.audioUrl || x.file,
                duration: m.duration ?? x.duration,
                forwarded: m.forwarded ?? x.forwarded,
                deletedForEveryone: m.deletedForEveryone ?? x.deletedForEveryone,
              };
            });
            const sorted = [...next].sort((a, b) => {
              const ax = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bx = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
              return ax - bx;
            });
            return { ...prev, [conversationId]: sorted };
          }
          // Reconcile retries/optimistic message with same clientMessageId (prevents duplicates).
          if (cmid && list.some((x) => x?.clientMessageId && String(x.clientMessageId) === cmid)) {
            const next = list.map((x) => {
              if (!x?.clientMessageId || String(x.clientMessageId) !== cmid) return x;
              return {
                ...x,
                _id: mid || x._id,
                text: isOwn ? (m.originalText ?? m.text ?? x.text) : (m.translatedText ?? m.text ?? x.text),
                originalText: m.originalText ?? m.text ?? x.originalText,
                translatedText: m.translatedText ?? m.text ?? x.translatedText,
                detectedLanguage: m.detectedLanguage ?? x.detectedLanguage,
                createdAt: createdAtIso,
                status: m.status ?? x.status ?? "sent",
                reactions: m.reactions || x.reactions || [],
                type: m.messageType || m.type || x.type || "text",
                file: m.fileUrl || m.file || m.audioUrl || x.file,
                duration: m.duration ?? x.duration,
                forwarded: m.forwarded ?? x.forwarded,
                deletedForEveryone: m.deletedForEveryone ?? x.deletedForEveryone,
              };
            });
            return { ...prev, [conversationId]: next };
          }
          const nextState = {
            ...prev,
            [conversationId]: [
              ...list,
              {
                _id: m._id != null ? String(m._id) : m._id,
                clientMessageId: cmid,
                text: isOwn ? (m.originalText ?? m.text) : (m.translatedText ?? m.text),
                originalText: m.originalText ?? m.text,
                translatedText: m.translatedText ?? m.text,
                detectedLanguage: m.detectedLanguage,
                isOwn,
                time,
                createdAt: createdAtIso,
                status: m.status ?? "sent",
                reactions: m.reactions || [],
                type: m.type || "text",
                file: m.fileUrl || m.file || m.audioUrl,
                duration: m.duration,
                forwarded: m.forwarded,
                deletedForEveryone: m.deletedForEveryone,
              },
            ],
          };
          return nextState;
        });

        // Unread separator logic: only for incoming messages when not at bottom
        if (!isOwn) {
          if (!isAtBottomRef.current && mid) {
            setUnreadSeparatorMessageId((prevId) => prevId || mid);
          } else if (isAtBottomRef.current) {
            setUnreadSeparatorMessageId(null);
          }
        }

        // Delivery ack:
        // - 1:1 uses messageDelivered(messageId)
        // - group uses groupMessageDelivered(messageId, groupId)
        if (!isOwn && mid) {
          if (groupId) {
            socket.emit("groupMessageDelivered", {
              messageId: mid,
              groupId: String(groupId),
            });
          } else {
            socket.emit("messageDelivered", {
              senderId: String(senderId),
              receiverId: String(userId),
              messageId: mid,
            });
          }
        }
      } else {
        const text = typeof message === "string" ? message : message?.text || "";
        const isOwn = String(senderId) === String(userId);

        // Only translate for 1-on-1 messages, not groups
        if (!groupId) {
          try {
            const { originalText, translatedText, detectedLanguage } = await translateText(
              text,
              preferredLanguageRef.current
            );
            setMessages((prev) => ({
              ...prev,
              [conversationId]: [
                ...(prev[conversationId] || []),
                {
                  text: translatedText ?? text,
                  originalText: originalText ?? text,
                  translatedText: translatedText ?? text,
                  detectedLanguage,
                  isOwn,
                  time,
                  createdAt: new Date().toISOString(),
                  status: "delivered",
                  reactions: [],
                  type: "text",
                },
              ],
            }));
          } catch (err) {
            console.error("Translate on receive failed:", err);
            setMessages((prev) => ({
              ...prev,
              [conversationId]: [
                ...(prev[conversationId] || []),
                {
                  text,
                  originalText: text,
                  translatedText: text,
                  isOwn,
                  time,
                  createdAt: new Date().toISOString(),
                  status: "sent",
                  reactions: [],
                  type: "text",
                },
              ],
            }));
          }
        } else {
          // Group message - use translatedText from backend if available
          const translatedText = message?.translatedText || text;
          const originalText = message?.originalText || text;
          const mid = message?._id != null ? String(message._id) : null;
          setMessages((prev) => {
            const list = prev[conversationId] || [];
            if (mid && list.some((x) => x?._id != null && String(x._id) === mid)) {
              const next = list.map((x) => {
                if (!x?._id || String(x._id) !== mid) return x;
                return {
                  ...x,
                  text: isOwn ? originalText : translatedText,
                  originalText,
                  translatedText,
                  detectedLanguage: message?.detectedLanguage ?? x.detectedLanguage,
                  createdAt: message?.createdAt ?? x.createdAt,
                  time,
                  status: message?.status ?? x.status ?? "sent",
                };
              });
              const sorted = [...next].sort((a, b) => {
                const ax = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bx = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                return ax - bx;
              });
              return { ...prev, [conversationId]: sorted };
            }
            return {
              ...prev,
              [conversationId]: [
                ...list,
                {
                  _id: message?._id != null ? String(message._id) : undefined,
                  text: isOwn ? originalText : translatedText,
                  originalText,
                  translatedText,
                  detectedLanguage: message?.detectedLanguage,
                  isOwn,
                  time,
                  createdAt: message?.createdAt,
                  status: message?.status ?? "sent",
                  reactions: [],
                  type: "text",
                },
              ],
            };
          });
        }
      }
    };

    socket.on("receiveMessage", handler);
    socket.on("receive_message", handler);
    socket.on("groupMessage", handler);
    socket.on("group_message", handler);

    return () => {
      socket.off("receiveMessage", handler);
      socket.off("receive_message", handler);
      socket.off("groupMessage", handler);
      socket.off("group_message", handler);
    };
  }, []); // stable — uses preferredLanguageRef to avoid re-registering on language change

  /* LOAD CHAT HISTORY */
  useEffect(() => {
    const fetchMessages = async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      const userId = user?.id || user?._id;
      if (!userId || !activeChat) return;

      const conversationId = String(activeChat._id);

      // 1) Instant render from local cache (no spinner if we have cached data)
      const cached = await loadConversationCache(conversationId);
      if (Array.isArray(cached) && cached.length) {
        setMessages((prev) => ({
          ...prev,
          [conversationId]: mergeMessageLists(cached, prev[conversationId] || []),
        }));
        setLoadingMessages(false);
      } else {
        setLoadingMessages(true);
      }

      try {
        // Check if it's a group chat
        const isGroup = activeChat.isGroup || false;
        const res = isGroup
          ? await getGroupMessages(activeChat._id)
          : await getMessages(userId, activeChat._id);

        const formatted = res.data.map((m) => {
          const msgType = m.messageType || m.type || "text";
          const isMedia = ["image", "video", "file", "link", "voice"].includes(msgType);
          const fileUrl = m.fileUrl || m.file || null;

          if (isMedia && fileUrl) {
            const isOwn = String(m.sender?._id || m.sender) === String(userId);
            return {
              _id: m._id != null ? String(m._id) : m._id,
              clientMessageId: m.clientMessageId,
              type: msgType,
              file: fileUrl,
              duration: m.duration,
              text: m.text || m.fileName || "",
              isOwn,
              time: new Date(m.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              createdAt: m.createdAt,
              status: m.status ?? (isOwn ? "sent" : "seen"),
              seenAt: m.seenAt,
              reactions: m.reactions || [],
              forwarded: m.forwarded,
              deletedForEveryone: m.deletedForEveryone,
            };
          }

          const isOwn = String(m.sender?._id || m.sender) === String(userId);
          const currentText = m.edited
            ? (m.text ?? "")
            : isOwn
              ? (m.originalText ?? m.text ?? "")
              : (m.translatedText || m.text || "");
          return {
            _id: m._id != null ? String(m._id) : m._id,
            clientMessageId: m.clientMessageId,
            type: "text",
            text: currentText,
            originalText: m.originalText ?? m.text ?? "",
            translatedText: isOwn ? (m.originalText ?? m.text ?? "") : (m.translatedText ?? m.text ?? ""),
            detectedLanguage: m.detectedLanguage,
            isOwn,
            time: new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            createdAt: m.createdAt,
            status: m.status ?? (isOwn ? "sent" : "seen"),
            seenAt: m.seenAt,
            reactions: m.reactions || [],
            forwarded: m.forwarded,
            deletedForEveryone: m.deletedForEveryone,
            edited: !!m.edited,
            editedAt: m.editedAt ?? null,
          };
        });

        setMessages((prev) => ({
          ...prev,
          [conversationId]: mergeMessageLists(prev[conversationId] || [], formatted),
        }));

        // Join group room if group chat
        if (activeChat.isGroup) {
          socket.emit("joinGroup", activeChat._id);
        }
      } catch (err) {
        toast.error("Failed to load messages. Please try again.");
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    const user = JSON.parse(localStorage.getItem("user"));
    if (user && activeChat) {
      const myId = user.id || user._id;
      // 1:1 only: mark read on open. Group read receipts are not implemented in this app.
      if (!activeChat.isGroup) {
        markSeen(String(activeChat._id), String(myId)).catch((err) =>
          console.error("markSeen failed:", err)
        );
      }
      amBlocking(activeChat._id)
        .then((r) => setBlockedByMe(!!r.data?.blocking))
        .catch(() => setBlockedByMe(false));
      checkBlocked(activeChat._id)
        .then((r) => setBlockedByThem(!!r.data?.blocked))
        .catch(() => setBlockedByThem(false));
    } else {
      setBlockedByMe(false);
      setBlockedByThem(false);
    }
  }, [activeChat]);

  /* TYPING LISTEN */
  useEffect(() => {
    socket.on("userTyping", (senderId) => {
      if (senderId === activeChat?._id) setTypingUser(senderId);
    });

    socket.on("userStopTyping", (senderId) => {
      if (senderId === activeChat?._id) setTypingUser(null);
    });

    // Aliases (WhatsApp-style)
    socket.on("typing", ({ senderId }) => {
      if (senderId === activeChat?._id) setTypingUser(senderId);
    });

    socket.on("stop_typing", ({ senderId }) => {
      if (senderId === activeChat?._id) setTypingUser(null);
    });

    return () => {
      socket.off("userTyping");
      socket.off("userStopTyping");
      socket.off("typing");
      socket.off("stop_typing");
    };
  }, [activeChat]);

  /* UPDATE STATUS (delivered / seen) for our sent messages - real-time without refresh */
  useEffect(() => {
    const order = { sent: 0, delivered: 1, seen: 2 };
    const handler = ({ receiverId, status }) => {
      if (!receiverId || !status) return;
      setMessages((prev) => {
        const cid = String(receiverId);
        const list = prev[cid];
        if (!list?.length) return prev;
        const updated = list.map((m) => {
          if (!m.isOwn) return m;
          const current = m.status || "sent";
          const next = status;
          if (order[next] > order[current]) {
            return { ...m, status: next };
          }
          return m;
        });
        return { ...prev, [cid]: updated };
      });
    };
    socket.on("updateStatus", handler);
    return () => socket.off("updateStatus", handler);
  }, []);

  /* MESSAGE STATUS (per-message) */
  useEffect(() => {
    const order = { sent: 0, delivered: 1, seen: 2 };

    const single = ({ messageId, conversationId, status }) => {
      if (!messageId || !conversationId || !status) return;
      const mid = String(messageId);
      const cid = String(conversationId);
      setMessages((prev) => {
        const list = prev?.[cid];
        if (!list?.length) return prev;
        let changed = false;
        const updated = list.map((m) => {
          if (!m?.isOwn) return m;
          if (m._id == null || String(m._id) !== mid) return m;
          const current = m.status || "sent";
          if (order[status] > order[current]) {
            changed = true;
            return { ...m, status };
          }
          return m;
        });
        return changed ? { ...prev, [cid]: updated } : prev;
      });
    };

    const batch = ({ messageIds, conversationId, status }) => {
      if (!Array.isArray(messageIds) || !messageIds.length || !conversationId || !status) return;
      const cid = String(conversationId);
      const set = new Set(messageIds.map(String));
      setMessages((prev) => {
        const list = prev?.[cid];
        if (!list?.length) return prev;
        let changed = false;
        const updated = list.map((m) => {
          if (!m?.isOwn) return m;
          if (m._id == null || !set.has(String(m._id))) return m;
          const current = m.status || "sent";
          if (order[status] > order[current]) {
            changed = true;
            return { ...m, status };
          }
          return m;
        });
        return changed ? { ...prev, [cid]: updated } : prev;
      });
    };

    socket.on("message_status", single);
    socket.on("message_status_batch", batch);
    return () => {
      socket.off("message_status", single);
      socket.off("message_status_batch", batch);
    };
  }, []);

  /* MARK SEEN (per-message) - emit read receipts without refresh */
  const lastSeenEmitKeyRef = useRef("");
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const myId = user?.id || user?._id;
    if (!myId || !activeChat || activeChat.isGroup) return;

    const cid = String(activeChat._id);
    const list = messages?.[cid] || [];
    const ids = list
      .filter((m) => m && !m.isOwn && m._id && m.status !== "seen")
      .map((m) => String(m._id));
    if (!ids.length) return;

    const key = `${cid}:${ids.join(",")}`;
    if (key === lastSeenEmitKeyRef.current) return;
    lastSeenEmitKeyRef.current = key;

    socket.emit("messageSeen", {
      senderId: cid,
      receiverId: String(myId),
      messageIds: ids,
    });
  }, [activeChat, messages]);

  /* GROUP SEEN (batched) */
  const lastGroupSeenEmitKeyRef = useRef("");
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const myId = user?.id || user?._id;
    if (!myId || !activeChat || !activeChat.isGroup) return;

    const gid = String(activeChat._id);
    const list = messages?.[gid] || [];
    const ids = list
      .filter((m) => m && !m.isOwn && m._id)
      .map((m) => String(m._id));
    if (!ids.length) return;

    // cap to last 200 to keep payload small; server is idempotent anyway
    const tail = ids.slice(-200);
    const key = `${gid}:${tail.join(",")}`;
    if (key === lastGroupSeenEmitKeyRef.current) return;
    lastGroupSeenEmitKeyRef.current = key;

    socket.emit("groupMessageSeen", {
      groupId: gid,
      messageIds: tail,
    });
  }, [activeChat, messages]);

  /* ONLINE USERS — convert array to Set for O(1) .has() lookups */
  useEffect(() => {
    const handler = (users) => setOnlineUsers(new Set(Array.isArray(users) ? users.map(String) : []));
    socket.on("onlineUsers", handler);
    socket.on("online_users", handler);
    return () => {
      socket.off("onlineUsers", handler);
      socket.off("online_users", handler);
    };
  }, []);

  /* USER ONLINE/OFFLINE + LAST SEEN */
  useEffect(() => {
    const handleUserOnline = ({ userId }) => {
      setUserStatus((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || {}), isOnline: true },
      }));
    };

    const handleUserOffline = ({ userId, lastSeen: lastSeenPayload }) => {
      setUserStatus((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          isOnline: false,
          ...(lastSeenPayload != null && { lastSeen: lastSeenPayload }),
        },
      }));
    };

    const handleLastSeenUpdate = ({ userId, lastSeen }) => {
      setUserStatus((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || {}), lastSeen },
      }));
    };

    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);
    socket.on("last_seen_update", handleLastSeenUpdate);

    // Real-time updates for friend requests and blocking
    const handleFriendRequestAccepted = ({ senderId, receiverId }) => {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const myId = user?.id || user?._id;
      if (!myId) return;

      // If current user is involved, reload contacts and recent chats
      if (String(senderId) === String(myId) || String(receiverId) === String(myId)) {
        loadContacts();
        // Note: Recent chats will update when first message is sent
        // But we can reload to ensure consistency
        loadRecentChats();
      }
    };

    const handleUserBlocked = ({ blockerId, blockedUserId }) => {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const myId = user?.id || user?._id;
      if (!myId) return;

      // If current user is involved, reload all panels
      if (String(blockerId) === String(myId) || String(blockedUserId) === String(myId)) {
        loadContacts();
        loadRecentChats();
        // Note: Discover panel is handled by UsersPanel component
      }
    };

    socket.on("request_accepted", handleFriendRequestAccepted);
    socket.on("user_blocked", handleUserBlocked);

    return () => {
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
      socket.off("last_seen_update", handleLastSeenUpdate);
      socket.off("request_accepted", handleFriendRequestAccepted);
      socket.off("user_blocked", handleUserBlocked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* SEND MESSAGE */
  const handleSendMessage = async (msg) => {
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user?.id || user?._id;
    if (!userId || !activeChat) return;

    const isGroup = activeChat.isGroup || false;
    const conversationId = String(activeChat._id);
    const deviceId = getDeviceId();
    const clientMessageId = generateClientMessageId();
    const createdAtIso = new Date().toISOString();

    const newMessage = {
      clientMessageId,
      text: msg,
      isOwn: true,
      status: "sending",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAt: createdAtIso,
    };

    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));

    // Play send sound (respecting setting)
    playSendSound();

    setSendingMessage(true);
    try {
      const res = await saveMessage({
        sender: userId,
        receiver: isGroup ? undefined : activeChat._id,
        group: isGroup ? activeChat._id : undefined,
        text: msg,
        clientMessageId,
        senderDeviceId: deviceId,
      });
      const savedMessage = res?.data;
      if (savedMessage?._id) {
        setMessages((prev) => {
          const list = prev[conversationId] || [];
          const next = list.map((m) => {
            if (m?.clientMessageId && String(m.clientMessageId) === String(clientMessageId)) {
              return {
                ...m,
                _id: savedMessage._id,
                text: savedMessage.translatedText ?? savedMessage.text ?? m.text,
                originalText: savedMessage.originalText ?? m.originalText,
                translatedText: savedMessage.translatedText ?? m.translatedText,
                detectedLanguage: savedMessage.detectedLanguage ?? m.detectedLanguage,
                status: savedMessage.status ?? "sent",
                createdAt: savedMessage.createdAt ?? m.createdAt,
              };
            }
            return m;
          });
          return { ...prev, [conversationId]: next };
        });
        await removeOutbox(clientMessageId);
      }
      socket.emit("sendMessage", {
        senderId: userId,
        receiverId: isGroup ? undefined : activeChat._id,
        groupId: isGroup ? activeChat._id : undefined,
        message: savedMessage || msg,
      });

      // Join group room if group message
      if (isGroup) {
        socket.emit("joinGroup", activeChat._id);
      }
    } catch (err) {
      // Persist for retry + background resend
      await enqueueOutbox({
        clientMessageId,
        sender: String(userId),
        receiver: isGroup ? undefined : String(activeChat._id),
        group: isGroup ? String(activeChat._id) : undefined,
        text: msg,
        type: "text",
        senderDeviceId: deviceId,
        createdAtMs: Date.now(),
      });
      // Keep UI stable (no UI changes), but inform the user once.
      toast.error("Message queued. Will retry when connection restores.");
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleMediaMessage = (saved) => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const userId = user?.id || user?._id;
    if (!userId) return;

    const senderId = saved.sender;
    const receiverId = saved.receiver;
    const groupId = saved.group;

    const isOwn = String(senderId) === String(userId);
    const convoId = groupId
      ? String(groupId)
      : String(isOwn ? receiverId : senderId);

    const messageType = saved.messageType || saved.type || "file";
    const messageObj = {
      _id: saved._id,
      type: messageType,
      file: saved.fileUrl || saved.file || saved.audioUrl,
      audioUrl: saved.audioUrl || saved.fileUrl || saved.file,
      duration: saved.duration,
      text: saved.text || saved.fileName || "",
      isOwn,
      time: new Date(saved.createdAt || Date.now()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => ({
      ...prev,
      [convoId]: [...(prev[convoId] || []), messageObj],
    }));
  };

  const handleTranslateMessage = async (messageId, text) => {
    if (!activeChat || !messageId || !text) return;
    try {
      const { originalText, translatedText, detectedLanguage } = await translateText(
        text,
        preferredLanguage
      );
      const cid = String(activeChat._id);
      const sid = String(messageId);
      setMessages((prev) => {
        const list = prev[cid] || [];
        const updated = list.map((m) =>
          String(m._id) === sid
            ? {
              ...m,
              originalText: originalText ?? text,
              translatedText: translatedText ?? text,
              detectedLanguage,
              text: translatedText ?? m.text,
            }
            : m
        );
        return { ...prev, [cid]: updated };
      });
    } catch (err) {
      console.error("Translate message failed:", err);
      toast.error("Translation failed");
    }
  };

  const handleSaveEditMessage = async (messageId, newText) => {
    if (!messageId || !newText?.trim()) {
      if (!messageId) toast.error("Cannot edit: message not saved yet. Try again in a moment.");
      return;
    }
    const sid = String(messageId);
    const trimmed = newText.trim();
    const editedAtNow = new Date().toISOString();

    const applyEdit = (prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cid) => {
        next[cid] = next[cid].map((m) =>
          String(m._id) === sid
            ? { ...m, text: trimmed, edited: true, editedAt: editedAtNow }
            : m
        );
      });
      return next;
    };

    let previousText = "";
    setMessages((prev) => {
      Object.keys(prev).forEach((cid) => {
        const msg = (prev[cid] || []).find((m) => String(m._id) === sid);
        if (msg) previousText = msg.text ?? msg.originalText ?? "";
      });
      return applyEdit(prev);
    });

    const revertEdit = (prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cid) => {
        next[cid] = next[cid].map((m) =>
          String(m._id) === sid ? { ...m, text: previousText, edited: !!m.edited, editedAt: m.editedAt } : m
        );
      });
      return next;
    };

    try {
      const res = await editMessage(messageId, trimmed);
      const updated = res?.data;
      if (updated?.text) {
        setMessages((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((cid) => {
            next[cid] = next[cid].map((m) =>
              String(m._id) === sid
                ? { ...m, text: updated.text, edited: true, editedAt: updated.editedAt ?? editedAtNow }
                : m
            );
          });
          return next;
        });
        toast.success("Message updated");
      }
      socket.emit("message_updated", {
        messageId: sid,
        text: updated?.text ?? trimmed,
        edited: true,
        editedAt: updated?.editedAt ?? editedAtNow,
      });
    } catch (err) {
      console.error("Edit message failed", err);
      setMessages(revertEdit);
      toast.error("Could not save edit. Please try again.");
    }
  };

  const handleCopyMessage = (id, text, fileUrl) => {
    const toCopy = (text && text.trim()) || (fileUrl && fileUrl.trim()) || "";
    if (!toCopy) {
      toast.error("Nothing to copy");
      return;
    }
    navigator.clipboard
      .writeText(toCopy)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Failed to copy"));
  };

  const handleDeleteForMe = async (id) => {
    if (!id) return;
    const sid = String(id);
    try {
      await axios.delete(`/messages/delete-for-me/${sid}`);
      setMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((cid) => {
          updated[cid] = updated[cid].filter((m) => String(m._id) !== sid);
        });
        return updated;
      });
      toast.success("Deleted for you");
    } catch (err) {
      console.error("Delete for me failed", err);
      toast.error("Failed to delete");
    }
  };

  const handleDeleteForEveryone = async (id, options = {}) => {
    if (!id) return;
    const sid = String(id);
    const { isScheduledCancel } = options || {};

    try {
      if (isScheduledCancel) {
        // Cancel scheduled message (server already ignores cancelled)
        await cancelScheduledMessage(sid);
        setMessages((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((cid) => {
            updated[cid] = updated[cid].map((m) =>
              String(m._id) === sid
                ? {
                  ...m,
                  status: "cancelled",
                }
                : m
            );
          });
          return updated;
        });
        toast.success("Scheduled message cancelled");
      } else {
        await axios.delete(`/messages/delete-for-everyone/${sid}`);
        setMessages((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((cid) => {
            updated[cid] = updated[cid].map((m) =>
              String(m._id) === sid
                ? {
                  ...m,
                  deletedForEveryone: true,
                  text: "This message was deleted",
                  file: null,
                  type: "text",
                }
                : m
            );
          });
          return updated;
        });
        toast.success("Deleted for everyone");
      }
    } catch (err) {
      console.error("Delete for everyone failed", err);
      toast.error("Failed to delete");
    }
  };

  const handleReactMessage = async (id, emoji) => {
    if (!id || !emoji) return;
    const sid = String(id);
    try {
      await axios.post("/messages/react", { messageId: sid, emoji });
    } catch (err) {
      console.error("React failed", err);
      toast.error("Failed to add reaction");
    }
  };

  const openForwardModal = (id) => {
    setForwardMessageId(id);
    setForwardModalOpen(true);
  };

  const handleConfirmForward = async (receiverIds) => {
    if (!forwardMessageId) return;
    try {
      await axios.post("/messages/forward", {
        messageId: forwardMessageId,
        receiverIds,
      });
      setForwardModalOpen(false);
      setForwardMessageId(null);
      toast.success("Message forwarded");
    } catch (err) {
      console.error("Forward failed", err);
      toast.error("Failed to forward");
    }
  };

  // Socket listeners for delete + reaction updates
  useEffect(() => {
    const deletedHandler = ({ messageId, scope, text }) => {
      const mid = messageId != null ? String(messageId) : "";
      if (!mid) return;
      setMessages((prev) => {
        const updated = { ...prev };
        if (scope === "me") {
          Object.keys(updated).forEach((cid) => {
            updated[cid] = updated[cid].filter((m) => String(m._id) !== mid);
          });
        } else if (scope === "everyone") {
          Object.keys(updated).forEach((cid) => {
            updated[cid] = updated[cid].map((m) =>
              String(m._id) === mid
                ? {
                  ...m,
                  deletedForEveryone: true,
                  text: text || "This message was deleted",
                  file: null,
                  type: "text",
                }
                : m
            );
          });
        }
        return updated;
      });
    };

    const reactionHandler = ({ messageId, reactions }) => {
      const mid = messageId != null ? String(messageId) : "";
      if (!mid) return;
      setMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((cid) => {
          updated[cid] = updated[cid].map((m) =>
            String(m._id) === mid ? { ...m, reactions: reactions || [] } : m
          );
        });
        return updated;
      });
    };

    const messageUpdatedHandler = ({ messageId, text, edited, editedAt }) => {
      const mid = messageId != null ? String(messageId) : "";
      if (!mid) return;
      setMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((cid) => {
          updated[cid] = updated[cid].map((m) =>
            String(m._id) === mid
              ? { ...m, text: text ?? m.text, edited: !!edited, editedAt: editedAt ?? m.editedAt }
              : m
          );
        });
        return updated;
      });
    };

    socket.on("message_deleted", deletedHandler);
    socket.on("message_reaction_update", reactionHandler);
    socket.on("message_updated", messageUpdatedHandler);

    // Debounced reload of recent chats — prevents hammering the API on rapid messages
    let recentChatsDebounceTimer = null;
    const handleNewMessageForRecentChats = () => {
      if (recentChatsDebounceTimer) clearTimeout(recentChatsDebounceTimer);
      recentChatsDebounceTimer = setTimeout(() => {
        loadRecentChats();
      }, 1500); // debounce 1.5s
    };

    socket.on("new_message", handleNewMessageForRecentChats);
    socket.on("receiveMessage", handleNewMessageForRecentChats);
    socket.on("receive_message", handleNewMessageForRecentChats);

    return () => {
      if (recentChatsDebounceTimer) clearTimeout(recentChatsDebounceTimer);
      socket.off("message_deleted", deletedHandler);
      socket.off("message_reaction_update", reactionHandler);
      socket.off("message_updated", messageUpdatedHandler);
      socket.off("new_message", handleNewMessageForRecentChats);
      socket.off("receiveMessage", handleNewMessageForRecentChats);
      socket.off("receive_message", handleNewMessageForRecentChats);
    };
  }, []);

  // Scroll behavior: auto-scroll only when at bottom or when chat changes
  useEffect(() => {
    const container = messagesContainerRef.current;
    const activeId = activeChat?._id ? String(activeChat._id) : null;
    if (!activeId || !container) return;

    if (lastActiveChatIdRef.current !== activeId) {
      // Chat switched: always go to bottom and reset helpers
      lastActiveChatIdRef.current = activeId;
      container.scrollTop = container.scrollHeight;
      isAtBottomRef.current = true;
      setShowScrollToBottom(false);
      setUnreadSeparatorMessageId(null);
      return;
    }

    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [activeChat, messages]);

  // Scroll listener: show scroll-to-bottom button, floating date, unread reset
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (scrollRafRef.current) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const el = messagesContainerRef.current;
        if (!el) return;

        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = distanceFromBottom < 50;
        isAtBottomRef.current = atBottom;
        setCurrentScrollTop(el.scrollTop);

        setShowScrollToBottom(!atBottom);
        if (atBottom) {
          setUnreadSeparatorMessageId(null);
        }

        // Floating date based on first visible message
        const rect = el.getBoundingClientRect();
        const nodes = el.querySelectorAll("[data-message-created-at]");
        let label = "";
        for (const node of nodes) {
          const nRect = node.getBoundingClientRect();
          if (nRect.bottom >= rect.top + 40) {
            const iso = node.getAttribute("data-message-created-at");
            label = formatDateLabel(iso);
            break;
          }
        }
        setFloatingDateLabel(atBottom ? "" : label);
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Initialize
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [activeChat]);

  /* FILE DROP - upload and add to chat */
  const handleDrop = async (e) => {
    e.preventDefault();
    if (!activeChat) return;

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const userId = user?.id || user?._id;
    if (!userId) return;

    const isGroup = !!activeChat.isGroup;
    let messageType = "file";
    if (file.type.startsWith("image/")) messageType = "image";
    else if (file.type.startsWith("video/")) messageType = "video";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("senderId", userId);
    if (isGroup) {
      formData.append("groupId", activeChat._id);
    } else {
      formData.append("receiverId", activeChat._id);
    }
    formData.append("messageType", messageType);

    try {
      const res = await axios.post("/messages/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      handleMediaMessage(res.data);
    } catch (err) {
      console.error("Drop upload failed", err);
      toast.error(err.response?.data?.message || "Failed to upload file");
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-gray-50 dark:bg-neutral-900 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full sm:w-full md:w-[96%] md:max-w-[1600px] md:h-[94%] md:rounded-2xl bg-white dark:bg-neutral-800/95 backdrop-blur-xl shadow-2xl border-0 md:border border-gray-200 dark:border-neutral-700 flex flex-col sm:flex-row overflow-hidden relative">

        {/* Icon rail — hidden on mobile/tablet (bottom nav used instead), visible from lg+ */}
        <div className="hidden lg:block w-[64px] md:w-[80px] shrink-0 h-full">
          <SidebarIcons
            activeView={activeView}
            onViewChange={setActiveView}
            onProfileClick={() => {
              setSidebarOpen(false);
              setProfilePanelShowSelf(true);
              setActivePanel((p) => p === "profile" ? null : "profile");
            }}
            onSettingsClick={() => {
              setSidebarOpen(false);
              setActivePanel((p) => p === "settings" ? null : "settings");
            }}
            onUsersClick={() => {
              setSidebarOpen(false);
              setActivePanel((p) => p === "users" ? null : "users");
            }}
            onRequestsClick={() => {
              setSidebarOpen(false);
              setActivePanel((p) => p === "requests" ? null : "requests");
            }}
            onCallsClick={() => {
              setActivePanel(null);
              setSidebarOpen(false);
            }}
            onChatsClick={() => {
              setActivePanel(null);
              setSidebarOpen((o) => !o);
            }}
            onContactsClick={() => {
              setActivePanel(null);
              setSidebarOpen((o) => !o);
            }}
          />
        </div>

        {/* Main center area: static sidebar on desktop, drawer on mobile/tablet */}
        <div className="flex-1 min-w-0 h-full flex flex-col lg:flex-row relative overflow-hidden">
          {/* Static sidebar for desktop */}
          <div className="hidden lg:flex w-[300px] shrink-0 border-r border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-700 flex items-center gap-2">
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 rounded-full bg-gray-100 dark:bg-neutral-700/80 text-gray-900 dark:text-neutral-100 outline-none border border-gray-300 dark:border-neutral-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                {activeView === "contacts" ? "All Contacts" : "Recent Chats"}
              </span>
              <div className="flex items-center gap-1">
                {activeView === "chats" && (
                  <button
                    onClick={() => setCreateGroupModalOpen(true)}
                    className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                    title="Create Group"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-2">
              {activeView === "chats" && (loadingRecentChats || loadingGroups) ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : activeView === "contacts" && loadingContacts ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : activeView === "chats" && recentChats.length === 0 && groups.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-gray-500 dark:text-neutral-400 mb-2">No chats yet</p>
                  <p className="text-sm text-gray-400 dark:text-neutral-500">Add contacts or create a group to start messaging</p>
                  <button
                    type="button"
                    onClick={() => setActiveView("contacts")}
                    className="mt-3 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
                  >
                    View Contacts
                  </button>
                </div>
              ) : activeView === "contacts" && contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-neutral-400">
                  <p>No contacts yet</p>
                </div>
              ) : (
                <>
                  {/* Groups - Only show in chats view */}
                  {activeView === "chats" &&
                    groups
                      .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
                      .map((group) => {
                        const expiresAt = group.selfDestruct?.expiresAt;
                        const isExpiring = expiresAt && new Date(expiresAt) > new Date();
                        const timeRemaining = isExpiring
                          ? Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60)))
                          : null;

                        return (
                          <div
                            key={group._id}
                            onClick={() => setActiveChat({ ...group, isGroup: true })}
                          >
                            <ChatItem
                              name={group.name}
                              avatar={group.groupLogo || group.avatar}
                              message={
                                isExpiring
                                  ? `Self-destructs in ${timeRemaining} min${timeRemaining !== 1 ? "s" : ""}`
                                  : group.description || `${group.members?.length || 0} members`
                              }
                              time=""
                              online={false}
                              active={activeChat?._id === group._id && activeChat?.isGroup}
                            />
                          </div>
                        );
                      })}

                  {/* Recent Chats - Show users with messages */}
                  {activeView === "chats" &&
                    recentChats
                      .filter((chat) => chat.username.toLowerCase().includes(search.toLowerCase()))
                      .map((chat) => {
                        const lastMessageTime = chat.lastMessageTime
                          ? new Date(chat.lastMessageTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          : "";
                        const lastMessagePreview = chat.lastMessage
                          ? chat.lastMessage.length > 30
                            ? chat.lastMessage.substring(0, 30) + "..."
                            : chat.lastMessage
                          : "Start chatting...";

                        return (
                          <div
                            key={chat._id}
                            onClick={() => setActiveChat(chat)}
                          >
                            <ChatItem
                              name={chat.username}
                              avatar={chat.avatar}
                              message={lastMessagePreview}
                              time={lastMessageTime}
                              online={onlineUsers.has(String(chat._id))}
                              active={activeChat?._id === chat._id && !activeChat?.isGroup}
                            />
                          </div>
                        );
                      })}

                  {/* Contacts - Show all accepted friends */}
                  {activeView === "contacts" &&
                    contacts
                      .filter((contact) => contact.username.toLowerCase().includes(search.toLowerCase()))
                      .map((contact) => (
                        <div
                          key={contact._id}
                          onClick={() => setActiveChat(contact)}
                        >
                          <ChatItem
                            name={contact.username}
                            avatar={contact.avatar}
                            message={contact.bio || "No bio"}
                            time=""
                            online={onlineUsers.has(String(contact._id))}
                            active={activeChat?._id === contact._id && !activeChat?.isGroup}
                          />
                        </div>
                      ))}
                </>
              )}
            </div>
          </div>

          {/* Calls / Chat column */}
          <div className="flex-1 min-w-0 h-full flex flex-col relative">
            {/* CALLS PANEL */}
            {activeView === "calls" && (
              <div className="flex-1 flex flex-col min-h-0">
                <CallsPanel />
              </div>
            )}

            {/* CHAT AREA */}
            {activeView !== "calls" && (
              <div
                className="flex-1 bg-gray-50 dark:bg-neutral-900 flex flex-col p-2 sm:p-3 md:p-5 pb-14 sm:pb-3 md:pb-5 relative bg-gradient-to-b from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-800/50 min-h-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {/* Connection status banner */}
                <AnimatePresence>
                  {!socketConnected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-2"
                    >
                      <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Reconnecting…
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {activeChat ? (
                  <>
                    <ChatHeader
                      activeChat={activeChat}
                      typingUser={typingUser}
                      isOnline={blockedByThem ? undefined : userStatus[activeChat._id]?.isOnline}
                      lastSeen={blockedByThem ? undefined : userStatus[activeChat._id]?.lastSeen}
                      onOpenFriendsList={() => setSidebarOpen(true)}
                      onlineUsersIncludes={blockedByThem ? false : onlineUsers.has(String(activeChat._id))}
                      hideProfilePhoto={blockedByThem}
                      onOpenProfile={() => {
                        if (activeChat.isGroup) {
                          setActivePanel((prev) =>
                            prev === "groupProfile" ? null : "groupProfile"
                          );
                        } else {
                          setProfilePanelShowSelf(false);
                          setActivePanel((prev) =>
                            prev === "profile" && !profilePanelShowSelf
                              ? null
                              : "profile"
                          );
                        }
                      }}
                      isBlocking={blockedByMe}
                      onBlock={async () => {
                        if (!activeChat?._id) return;
                        try {
                          await blockUser(activeChat._id);
                          setBlockedByMe(true);
                          toast.success("User blocked");
                        } catch (e) {
                          console.error("Block failed:", e);
                          toast.error(e.response?.data?.message || "Failed to block");
                        }
                      }}
                      onUnblock={async () => {
                        if (!activeChat?._id) return;
                        try {
                          await unblockUser(activeChat._id);
                          setBlockedByMe(false);
                          toast.success("User unblocked");
                        } catch (e) {
                          console.error("Unblock failed:", e);
                          toast.error(e.response?.data?.message || "Failed to unblock");
                        }
                      }}
                      onSearchSelectMessage={handleSearchSelectMessage}
                      searchMessagesList={messages[String(activeChat._id)] ?? []}
                      onClose={() => setActiveChat(null)}
                    />

                    <div
                      ref={messagesContainerRef}
                      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 sm:py-4 md:py-5 px-2 sm:px-3 md:px-4 space-y-2 sm:space-y-2.5 scroll-smooth"
                    >
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-8">
                          <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      ) : messages[String(activeChat._id)]?.length > 0 ? (
                        (() => {
                          const list = messages[String(activeChat._id)] || [];
                          const elements = [];
                          let lastDateKey = null;

                          list.forEach((msg, index) => {
                            const dateKey = getDateKey(msg.createdAt);
                            if (dateKey && dateKey !== lastDateKey) {
                              lastDateKey = dateKey;
                              elements.push(
                                <DateSeparator
                                  key={`sep-${dateKey}-${index}`}
                                  label={formatDateLabel(msg.createdAt)}
                                />
                              );
                            }

                            const isUnreadAnchor =
                              unreadSeparatorMessageId &&
                              msg._id &&
                              String(msg._id) === String(unreadSeparatorMessageId);
                            if (isUnreadAnchor) {
                              elements.push(
                                <NewMessagesSeparator key={`unread-${msg._id}`} />
                              );
                            }

                            elements.push(
                              <motion.div
                                key={msg._id || msg.clientMessageId || `m-${index}`}
                                data-message-id={msg._id ?? undefined}
                                data-message-created-at={msg.createdAt ?? ""}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                              >
                                {msg.type === "voice" ? (
                                  <VoiceMessageBubble
                                    id={msg._id}
                                    audioUrl={msg.file || msg.audioUrl}
                                    duration={msg.duration}
                                    isOwn={msg.isOwn}
                                    time={msg.time}
                                    onCopy={handleCopyMessage}
                                    onDeleteForMe={handleDeleteForMe}
                                    onDeleteForEveryone={handleDeleteForEveryone}
                                    onForward={openForwardModal}
                                  />
                                ) : msg.isOwn ? (
                                  <MessageBubble
                                    id={msg._id}
                                    text={msg.text ?? ""}
                                    isOwn
                                    type={msg.type || "text"}
                                    file={msg.file}
                                    time={msg.time}
                                    status={msg.status}
                                    seenAt={msg.seenAt}
                                    reactions={msg.reactions || []}
                                    forwarded={msg.forwarded}
                                    deletedForEveryone={msg.deletedForEveryone}
                                    edited={msg.edited}
                                    editedAt={msg.editedAt}
                                    highlightQuery={String(msg._id) === String(highlightMessageId) ? highlightQuery : ""}
                                    onCopy={handleCopyMessage}
                                    onDeleteForMe={handleDeleteForMe}
                                    onDeleteForEveryone={handleDeleteForEveryone}
                                    onReact={handleReactMessage}
                                    onForward={openForwardModal}
                                    onSaveEdit={handleSaveEditMessage}
                                  />
                                ) : (
                                  <TranslatedMessageBubble
                                    message={{
                                      ...msg,
                                      translatedText:
                                        activeChat.isGroup && msg.translatedText
                                          ? msg.translatedText
                                          : msg.translatedText,
                                      originalText: msg.originalText || msg.text,
                                    }}
                                    highlightQuery={String(msg._id) === String(highlightMessageId) ? highlightQuery : ""}
                                    onCopy={handleCopyMessage}
                                    onDeleteForMe={handleDeleteForMe}
                                    onDeleteForEveryone={handleDeleteForEveryone}
                                    onReact={handleReactMessage}
                                    onForward={openForwardModal}
                                    onTranslateRequest={activeChat.isGroup ? undefined : handleTranslateMessage}
                                  />
                                )}
                              </motion.div>
                            );
                          });

                          return elements;
                        })()
                      ) : (
                        <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-neutral-400 px-4">
                          <p className="text-sm sm:text-base">No messages yet. Start the conversation!</p>
                        </div>
                      )}
                    </div>

                    {blockedByMe ? (
                      <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-sm p-4 rounded-2xl border border-gray-200 dark:border-neutral-700 text-center text-gray-600 dark:text-neutral-400 text-sm shadow-md">
                        You blocked this user
                      </div>
                    ) : (
                      <div className="pb-[env(safe-area-inset-bottom)]">
                        <MessageInput
                          onSend={handleSendMessage}
                          onMediaMessage={handleMediaMessage}
                          activeChatId={activeChat._id}
                          isGroup={!!activeChat.isGroup}
                          disabled={sendingMessage}
                          onSchedule={(text) => {
                            setScheduleText(text || "");
                            setScheduleMessageModalOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <motion.div
                      className="text-center px-6"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex items-center justify-center shadow-lg">
                        <MessageCircle className="w-10 h-10 text-emerald-500" />
                      </div>
                      <p className="text-gray-900 dark:text-neutral-100 text-lg font-medium">Select a chat to start messaging</p>
                      <p className="text-gray-500 dark:text-neutral-400 text-sm mt-2">Use the chat icon to open your list</p>
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          className={`transition-all duration-300 ease-in-out ${activePanel ? "w-full sm:w-[300px] md:w-[340px]" : "w-0"
            } overflow-hidden absolute sm:absolute md:relative inset-y-0 right-0 z-40 bg-white dark:bg-neutral-800`}
        >
          <Suspense fallback={<PanelLoader />}>
            {activePanel === "profile" && (
              <ProfilePanel
                onClose={() => setActivePanel(null)}
                currentUserId={JSON.parse(localStorage.getItem("user"))?.id || JSON.parse(localStorage.getItem("user"))?._id}
                selectedUserId={profilePanelShowSelf ? null : activeChat?._id}
                selectedUser={profilePanelShowSelf ? null : activeChat}
                sharedMediaWithUserId={activeChat?._id}
                onBlockChange={() => activeChat && amBlocking(activeChat._id).then((r) => setBlockedByMe(!!r.data?.blocking)).catch(() => setBlockedByMe(false))}
              />
            )}
            {activePanel === "groupProfile" && activeChat?.isGroup && (
              <GroupProfilePanel
                groupId={activeChat._id}
                onClose={() => setActivePanel(null)}
                onGroupUpdated={async () => {
                  await loadGroups();
                  const res = await getUserGroups();
                  const updatedGroup = res.data.groups.find(g => String(g._id) === String(activeChat._id));
                  if (updatedGroup) {
                    setActiveChat({ ...updatedGroup, isGroup: true });
                  }
                }}
                onGroupDisbanded={async () => {
                  await loadGroups();
                  setActiveChat(null);
                }}
              />
            )}
            {activePanel === "settings" && (
              <SettingsPanel onClose={() => setActivePanel(null)} />
            )}
            {activePanel === "users" && (
              <UsersPanel onClose={() => setActivePanel(null)} />
            )}
            {activePanel === "requests" && (
              <RequestsPanel
                onClose={() => setActivePanel(null)}
                onFriendsUpdated={loadFriends}
              />
            )}

          </Suspense>
        </div>

        {/* Mobile Panel Overlay */}
        <AnimatePresence>
          {activePanel && (
            <motion.div
              className="md:hidden fixed inset-0 bg-black/50 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActivePanel(null)}
            />
          )}
        </AnimatePresence>

        {/* LEFT SIDEBAR DRAWER — for mobile (full-width, no rail) and tablet (offset by rail) */}
        <AnimatePresence>
          {sidebarOpen && (activeView === "chats" || activeView === "contacts") && (
            <>
              <motion.div
                className="absolute inset-y-0 left-0 sm:left-[64px] md:left-[80px] right-0 bg-black/40 z-40 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                className="absolute inset-y-0 left-0 sm:left-[64px] md:left-[80px] right-0 lg:hidden bg-white dark:bg-neutral-800/95 backdrop-blur-xl border-r border-gray-200 dark:border-neutral-700 z-50 flex flex-col"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 md:p-5 flex items-center gap-3 border-b border-gray-200 dark:border-neutral-700">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="min-w-[44px] min-h-[44px] p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Close sidebar"
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-full bg-gray-100 dark:bg-neutral-700/80 text-gray-900 dark:text-neutral-100 outline-none border border-gray-300 dark:border-neutral-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-neutral-400"
                  />
                </div>

                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                    {activeView === "chats" ? "Recent Chats" : "All Contacts"}
                  </span>
                  {activeView === "chats" && (
                    <button
                      onClick={() => setCreateGroupModalOpen(true)}
                      className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Create Group"
                      aria-label="Create Group"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto mt-1 pb-2">
                  {activeView === "chats" && (loadingRecentChats || loadingGroups) ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : activeView === "contacts" && loadingContacts ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : activeView === "chats" && recentChats.length === 0 && groups.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <p className="text-gray-500 dark:text-neutral-400 mb-2">No chats yet</p>
                      <p className="text-sm text-gray-400 dark:text-neutral-500">Add contacts or create a group to start messaging</p>
                      <button
                        type="button"
                        onClick={() => { setActiveView("contacts"); setSidebarOpen(false); }}
                        className="mt-3 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
                      >
                        View Contacts
                      </button>
                    </div>
                  ) : activeView === "contacts" && contacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-neutral-400">
                      <p>No contacts yet</p>
                    </div>
                  ) : (
                    <>
                      {/* Groups - Only show in chats view */}
                      {activeView === "chats" && groups
                        .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
                        .map((group) => {
                          const expiresAt = group.selfDestruct?.expiresAt;
                          const isExpiring = expiresAt && new Date(expiresAt) > new Date();
                          const timeRemaining = isExpiring
                            ? Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60)))
                            : null;

                          return (
                            <div
                              key={group._id}
                              onClick={() => {
                                setActiveChat({ ...group, isGroup: true });
                                setSidebarOpen(false);
                              }}
                            >
                              <ChatItem
                                name={group.name}
                                avatar={group.groupLogo || group.avatar}
                                message={
                                  isExpiring
                                    ? `Self-destructs in ${timeRemaining} min${timeRemaining !== 1 ? "s" : ""}`
                                    : group.description || `${group.members?.length || 0} members`
                                }
                                time=""
                                online={false}
                                active={activeChat?._id === group._id && activeChat?.isGroup}
                              />
                            </div>
                          );
                        })}

                      {/* Recent Chats - Show users with messages */}
                      {activeView === "chats" &&
                        recentChats
                          .filter((chat) => chat.username.toLowerCase().includes(search.toLowerCase()))
                          .map((chat) => {
                            const lastMessageTime = chat.lastMessageTime
                              ? new Date(chat.lastMessageTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "";
                            const lastMessagePreview = chat.lastMessage
                              ? chat.lastMessage.length > 30
                                ? chat.lastMessage.substring(0, 30) + "..."
                                : chat.lastMessage
                              : "Start chatting...";

                            return (
                              <div
                                key={chat._id}
                                onClick={() => {
                                  setActiveChat(chat);
                                  setSidebarOpen(false);
                                }}
                              >
                                <ChatItem
                                  name={chat.username}
                                  avatar={chat.avatar}
                                  message={lastMessagePreview}
                                  time={lastMessageTime}
                                  online={onlineUsers.has(String(chat._id))}
                                  active={activeChat?._id === chat._id && !activeChat?.isGroup}
                                />
                              </div>
                            );
                          })}

                      {/* Contacts - Show all accepted friends */}
                      {activeView === "contacts" &&
                        contacts
                          .filter((contact) => contact.username.toLowerCase().includes(search.toLowerCase()))
                          .map((contact) => (
                            <div
                              key={contact._id}
                              onClick={() => {
                                setActiveChat(contact);
                                setSidebarOpen(false);
                              }}
                            >
                              <ChatItem
                                name={contact.username}
                                avatar={contact.avatar}
                                message={contact.bio || "No bio"}
                                time=""
                                online={onlineUsers.has(String(contact._id))}
                                active={activeChat?._id === contact._id && !activeChat?.isGroup}
                              />
                            </div>
                          ))}
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
      <Suspense fallback={null}>
        <ForwardModal
          isOpen={forwardModalOpen}
          onClose={() => setForwardModalOpen(false)}
          onConfirm={handleConfirmForward}
        />
        <CreateGroupModal
          isOpen={createGroupModalOpen}
          onClose={() => setCreateGroupModalOpen(false)}
          friends={contacts.length > 0 ? contacts : friends}
          onGroupCreated={(group) => {
            setGroups((prev) => [group, ...prev]);
            setActiveChat({ ...group, isGroup: true });
          }}
        />
        <ScheduleMessageModal
          isOpen={scheduleMessageModalOpen}
          onClose={() => {
            setScheduleMessageModalOpen(false);
            setScheduleText("");
          }}
          receiverId={activeChat && !activeChat.isGroup ? activeChat._id : undefined}
          groupId={activeChat && activeChat.isGroup ? activeChat._id : undefined}
          initialText={scheduleText}
          onScheduled={(scheduledMsg, scheduledDateTime) => {
            const when = scheduledDateTime instanceof Date ? scheduledDateTime : (scheduledMsg?.scheduledFor ? new Date(scheduledMsg.scheduledFor) : null);
            if (when && !Number.isNaN(when.getTime())) {
              toast.success(`Message scheduled for ${when.toLocaleString()}`);
            } else {
              toast.success("Message scheduled");
            }

            // Insert scheduled bubble immediately (dim + clock label handled in MessageBubble)
            const user = JSON.parse(localStorage.getItem("user") || "null");
            const myId = user?.id || user?._id;
            if (!myId || !activeChat?._id) return;

            const conversationId = String(activeChat._id);
            const createdAtIso = when ? when.toISOString() : new Date().toISOString();
            const time = when
              ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            const bubble = {
              _id: scheduledMsg?._id != null ? String(scheduledMsg._id) : undefined,
              clientMessageId: scheduledMsg?.clientMessageId,
              type: scheduledMsg?.messageType || scheduledMsg?.type || "text",
              text: scheduledMsg?.text || "",
              originalText: scheduledMsg?.originalText ?? scheduledMsg?.text ?? "",
              translatedText: scheduledMsg?.translatedText ?? scheduledMsg?.text ?? "",
              detectedLanguage: scheduledMsg?.detectedLanguage,
              isOwn: true,
              time,
              createdAt: createdAtIso,
              status: "scheduled",
              scheduledFor: createdAtIso,
              reactions: [],
            };

            setMessages((prev) => ({
              ...prev,
              [conversationId]: mergeMessageLists(prev[conversationId] || [], [bubble]),
            }));
          }}
        />
      </Suspense>

      {/* Floating scroll-to-bottom button — absolute within app container */}
      {showScrollToBottom && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="absolute bottom-20 sm:bottom-8 right-4 sm:right-5 z-40 w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg flex items-center justify-center transition-all active:scale-90"
        >
          <FiArrowDown size={18} />
        </button>
      )}

      {/* Sticky floating date while scrolling — absolute within container */}
      {floatingDateLabel && (
        <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <span className="px-3 py-1 text-xs bg-neutral-800/90 text-neutral-300 rounded-full shadow-md backdrop-blur-sm">
            {floatingDateLabel}
          </span>
        </div>
      )}

      {/* Mobile/Tablet Bottom Navigation — horizontal slider */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700 py-1 pb-[env(safe-area-inset-bottom)]">
        <div
          ref={mobileNavScrollRef}
          onScroll={() => {
            const el = mobileNavScrollRef.current;
            if (!el) return;
            const pageWidth = Math.max(el.clientWidth, 1);
            const total = Math.max(1, Math.ceil(el.scrollWidth / pageWidth));
            const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
            const progress = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
            setMobileNavPages(total);
            setMobileNavPage(Math.round(progress * (total - 1)));
          }}
          className="flex items-center overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        <button
          type="button"
          onClick={() => { setActiveView("chats"); setActivePanel(null); setSidebarOpen((o) => !o); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activeView === "chats" && sidebarOpen ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <MessageCircle size={20} />
          <span className="text-[10px] font-medium">Chats</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveView("contacts"); setActivePanel(null); setSidebarOpen((o) => !o); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activeView === "contacts" && sidebarOpen ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <UsersIcon size={20} />
          <span className="text-[10px] font-medium">Contacts</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveView("calls"); setActivePanel(null); setSidebarOpen(false); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activeView === "calls" ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <Phone size={20} />
          <span className="text-[10px] font-medium">Calls</span>
        </button>
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setActivePanel((p) => p === "settings" ? null : "settings"); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activePanel === "settings" ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <Settings size={20} />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setProfilePanelShowSelf(true); setActivePanel((p) => p === "profile" ? null : "profile"); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activePanel === "profile" ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <User size={20} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setActivePanel((p) => p === "requests" ? null : "requests"); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activePanel === "requests" ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <Bell size={20} />
          <span className="text-[10px] font-medium">Alerts</span>
        </button>
        <button
          type="button"
          onClick={() => { setSidebarOpen(false); setActivePanel((p) => p === "users" ? null : "users"); }}
          className={`shrink-0 w-[20%] flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg transition-colors ${activePanel === "users" ? "text-emerald-500" : "text-gray-500 dark:text-neutral-400"}`}
        >
          <UserPlus size={20} />
          <span className="text-[10px] font-medium">Discover</span>
        </button>
        </div>
        {mobileNavPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-0.5 pt-0.5">
            {Array.from({ length: mobileNavPages }).map((_, index) => (
              <span
                key={`mobile-nav-dot-${index}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  mobileNavPage === index
                    ? "w-4 bg-emerald-500"
                    : "w-1.5 bg-gray-300 dark:bg-neutral-600"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
