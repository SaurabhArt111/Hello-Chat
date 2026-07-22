import React, { useState, useRef, useEffect, useCallback } from "react";
import Avatar from "../common/Avatar";
import CallButtons from "../call/CallButtons";
import MessageSearchBar from "./MessageSearchBar";
import { Menu, MoreVertical, Search, X, Phone, Video, User, Shield, ShieldOff } from "lucide-react";
import { useCall } from "../../context/CallContext";

/* ─── helpers ─── */
const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return "";
  const date = new Date(lastSeen);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Last seen at ${time}` : `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
};

/* ─── icon button primitive ─── */
const IconBtn = ({ onClick, disabled, label, title, className = "", children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`
      relative flex items-center justify-center
      w-10 h-10 rounded-xl shrink-0
      text-gray-500 dark:text-neutral-400
      hover:bg-gray-100 dark:hover:bg-neutral-700
      hover:text-gray-900 dark:hover:text-neutral-100
      active:scale-95
      disabled:opacity-40 disabled:cursor-not-allowed
      transition-all duration-150
      ${className}
    `}
    aria-label={label}
    title={title || label}
  >
    {children}
  </button>
);

/* ═══════════════════════════════════════════════════
   ChatHeader — production-grade responsive header
   ═══════════════════════════════════════════════════ */
const ChatHeader = ({
  activeChat,
  typingUser,
  isOnline,
  lastSeen,
  onOpenFriendsList,
  onlineUsersIncludes,
  hideProfilePhoto = false,
  onOpenProfile,
  isBlocking = false,
  onBlock,
  onUnblock,
  onSearchSelectMessage,
  searchMessagesList = [],
  onClose,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const menuRef = useRef(null);
  const { startCall, callState } = useCall();
  const callBusy = callState !== "idle";

  /* close menu on outside click */
  const handleClickOutside = useCallback((e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  if (!activeChat) return null;

  const isGroup = activeChat.isGroup || false;
  const displayName = isGroup ? activeChat.name : activeChat.username;
  const isOnlineNow = isOnline || onlineUsersIncludes;
  const avatarSrc = hideProfilePhoto
    ? undefined
    : isGroup
    ? activeChat.groupLogo || activeChat.avatar
    : activeChat.avatar;

  /* ─── status node ─── */
  let statusText = "Offline";
  let statusColor = "text-gray-400 dark:text-neutral-500";
  let statusDot = false;
  let statusPulse = false;

  if (isGroup) {
    statusText = `${activeChat.members?.length || 0} member${(activeChat.members?.length || 0) !== 1 ? "s" : ""}`;
    statusColor = "text-gray-500 dark:text-neutral-400";
  } else if (typingUser) {
    statusText = "typing…";
    statusColor = "text-emerald-500 dark:text-emerald-400";
    statusPulse = true;
  } else if (isOnlineNow) {
    statusText = "Online";
    statusColor = "text-emerald-500 dark:text-emerald-400";
    statusDot = true;
  } else if (lastSeen) {
    statusText = formatLastSeen(lastSeen);
    statusColor = "text-gray-400 dark:text-neutral-500";
  }

  /* ─── call handlers ─── */
  const handleAudioCall = () => {
    if (callBusy || !activeChat._id || isGroup) return;
    startCall("audio", activeChat._id, activeChat.username);
  };
  const handleVideoCall = () => {
    if (callBusy || !activeChat._id || isGroup) return;
    startCall("video", activeChat._id, activeChat.username);
  };

  /* ────────────────────────────────────────────────
     SEARCH BAR MODE — full-width search experience
     ──────────────────────────────────────────────── */
  if (showSearchBar) {
    return (
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-white dark:bg-neutral-800/95 backdrop-blur-md border-b border-gray-200/80 dark:border-neutral-700/80 shadow-sm">
        <IconBtn
          onClick={() => setShowSearchBar(false)}
          label="Close search"
        >
          <X size={20} />
        </IconBtn>
        <div className="flex-1 min-w-0">
          <MessageSearchBar
            chatId={activeChat?._id}
            messages={searchMessagesList}
            onSelectMessage={(msg, query) => {
              onSearchSelectMessage?.(msg, query);
              setShowSearchBar(false);
            }}
            onClose={() => setShowSearchBar(false)}
          />
        </div>
      </header>
    );
  }

  /* ────────────────────────────────────────────────
     MAIN HEADER
     ──────────────────────────────────────────────── */
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-2.5 bg-white dark:bg-neutral-800/95 backdrop-blur-md border-b border-gray-200/80 dark:border-neutral-700/80 shadow-sm">

      {/* ═══ LEFT SECTION: Menu + Avatar + Info ═══ */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">

        {/* Hamburger — mobile only */}
        <IconBtn
          onClick={onOpenFriendsList}
          label="Open chats list"
          className="sm:hidden"
        >
          <Menu size={20} />
        </IconBtn>

        {/* Avatar + Contact Info — clickable to open profile */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 text-left rounded-xl p-1.5 -ml-1.5 hover:bg-gray-50 dark:hover:bg-neutral-700/40 active:bg-gray-100 dark:active:bg-neutral-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
        >
          {/* Avatar — fixed size, never shrinks */}
          <div className="shrink-0">
            <Avatar
              name={displayName}
              src={avatarSrc}
              size="md"
              online={isGroup ? false : isOnlineNow}
            />
          </div>

          {/* Name + Status — flexible, truncates gracefully */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[15px] leading-tight text-gray-900 dark:text-neutral-100 truncate">
              {displayName}
            </h3>
            <p className={`text-xs leading-tight mt-0.5 flex items-center gap-1.5 ${statusColor} ${statusPulse ? "animate-pulse" : ""}`}>
              {statusDot && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              )}
              <span className="truncate">{statusText}</span>
            </p>
          </div>
        </button>
      </div>

      {/* ═══ RIGHT SECTION: Actions ═══ */}
      <div className="flex items-center shrink-0">

        {/* Search — visible on all screens */}
        <IconBtn
          onClick={() => setShowSearchBar(true)}
          label="Search in chat"
        >
          <Search size={19} />
        </IconBtn>

        {/* Call buttons — visible only on md+ screens */}
        {!isGroup && (
          <>
            <IconBtn
              onClick={handleAudioCall}
              disabled={callBusy || !isOnlineNow}
              label="Audio call"
              className="hidden md:flex"
            >
              <Phone size={19} className="text-emerald-600 dark:text-emerald-400" />
            </IconBtn>
            <IconBtn
              onClick={handleVideoCall}
              disabled={callBusy || !isOnlineNow}
              label="Video call"
              className="hidden md:flex"
            >
              <Video size={19} className="text-blue-600 dark:text-blue-400" />
            </IconBtn>
          </>
        )}

        {/* ⋮ Overflow menu */}
        <div className="relative" ref={menuRef}>
          <IconBtn
            onClick={() => setMenuOpen((o) => !o)}
            label="More options"
          >
            <MoreVertical size={19} />
          </IconBtn>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 py-1.5 w-52 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">

              {/* View profile */}
              <button
                type="button"
                onClick={() => { onOpenProfile?.(); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700/60 transition-colors"
              >
                <User size={16} className="shrink-0 text-gray-400 dark:text-neutral-500" />
                View profile
              </button>

              {/* Audio call — mobile only (hidden on md+) */}
              {!isGroup && (
                <button
                  type="button"
                  onClick={() => { handleAudioCall(); setMenuOpen(false); }}
                  disabled={callBusy || !isOnlineNow}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:hidden"
                >
                  <Phone size={16} className="shrink-0 text-emerald-500" />
                  Audio call
                </button>
              )}

              {/* Video call — mobile only (hidden on md+) */}
              {!isGroup && (
                <button
                  type="button"
                  onClick={() => { handleVideoCall(); setMenuOpen(false); }}
                  disabled={callBusy || !isOnlineNow}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors md:hidden"
                >
                  <Video size={16} className="shrink-0 text-blue-500" />
                  Video call
                </button>
              )}

              {/* Divider */}
              <div className="my-1 h-px bg-gray-100 dark:bg-neutral-700" />

              {/* Block/Unblock */}
              {!isGroup && (
                isBlocking ? (
                  <button
                    type="button"
                    onClick={() => { onUnblock?.(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700/60 transition-colors"
                  >
                    <ShieldOff size={16} className="shrink-0 text-gray-400 dark:text-neutral-500" />
                    Unblock user
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { onBlock?.(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Shield size={16} className="shrink-0" />
                    Block user
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Close button — only when onClose is provided */}
        {onClose && (
          <IconBtn onClick={onClose} label="Close chat">
            <X size={19} />
          </IconBtn>
        )}
      </div>
    </header>
  );
};

export default ChatHeader;
