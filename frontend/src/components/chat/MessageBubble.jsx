import React, { useState, useRef, useEffect } from "react";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionPicker from "./ReactionPicker";
import { Clock } from "lucide-react";

const urlRegex = /(https?:\/\/\S+)/gi;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderTextWithLinks = (text, highlightQuery = "") => {
  if (!text) return null;
  const parts = text.split(urlRegex);
  const highlightRegex = highlightQuery
    ? new RegExp(escapeRegex(highlightQuery), "gi")
    : null;

  const wrapHighlight = (str, keyPrefix) => {
    if (!str || !highlightRegex) return <span key={keyPrefix}>{str}</span>;
    const bits = [];
    let lastIndex = 0;
    let match;
    const re = new RegExp(escapeRegex(highlightQuery), "gi");
    let key = 0;
    while ((match = re.exec(str)) !== null) {
      bits.push(<span key={`${keyPrefix}-${key++}`}>{str.slice(lastIndex, match.index)}</span>);
      bits.push(<mark key={`${keyPrefix}-${key++}`} className="bg-yellow-200 dark:bg-yellow-900/50 rounded px-0.5">{match[0]}</mark>);
      lastIndex = match.index + match[0].length;
    }
    bits.push(<span key={`${keyPrefix}-${key++}`}>{str.slice(lastIndex)}</span>);
    return <>{bits}</>;
  };

  return (
    <p className="text-sm leading-tight break-words whitespace-pre-wrap">
      {parts.map((part, idx) =>
        urlRegex.test(part) ? (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 underline break-all"
          >
            {part}
          </a>
        ) : (
          wrapHighlight(part, `t-${idx}`)
        )
      )}
    </p>
  );
};

const MessageBubble = ({
  id,
  text,
  isOwn,
  type = "text",
  file,
  time,
  status,
  scheduledFor,
  seenAt,
  reactions = [],
  forwarded = false,
  deletedForEveryone = false,
  edited = false,
  editedAt,
  highlightQuery = "",
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onForward,
  onSaveEdit,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const longPressTimerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setEditText(text);
  }, [text]);

  const closeAll = () => {
    setShowMenu(false);
    setShowPicker(false);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditText(text);
    closeAll();
  };

  const handleSaveEdit = () => {
    const trimmed = editText?.trim?.() ?? "";
    if (trimmed && trimmed !== text && onSaveEdit) {
      onSaveEdit(id, trimmed);
    }
    setIsEditing(false);
    closeAll();
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => setShowMenu(true), 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isScheduled = status === "scheduled";
  const scheduledLabel =
    isScheduled && scheduledFor
      ? (() => {
          const d = new Date(scheduledFor);
          if (Number.isNaN(d.getTime())) return "Scheduled";
          return `Scheduled for ${d.toLocaleString()}`;
        })()
      : isScheduled
        ? "Scheduled"
        : null;

  // Close menu/picker when clicking outside or on the bubble
  useEffect(() => {
    if (!showMenu && !showPicker) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeAll();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showMenu, showPicker]);

  const safeReactions = Array.isArray(reactions) ? reactions : [];
  const groupedReactions = safeReactions.reduce((acc, r) => {
    const emoji = r?.emoji ?? r;
    if (!emoji) return acc;
    if (!acc[emoji]) acc[emoji] = 0;
    acc[emoji] += 1;
    return acc;
  }, {});

  const bubbleClasses = `
    w-fit max-w-[600px] px-3 py-1.5 text-sm leading-tight break-words rounded-2xl shadow-md relative inline-block
    ${isScheduled ? "opacity-70" : ""}
    ${isOwn
      ? "ml-auto rounded-br-md bg-emerald-500 text-white"
      : "rounded-bl-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 border border-gray-200 dark:border-neutral-600"
    }
  `;

  return (
    <div className={`flex my-1 ${isOwn ? "justify-end" : "justify-start"} w-full px-1 sm:px-2`}>
      <div
        ref={containerRef}
        className="relative"
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className={bubbleClasses}
          onClick={(e) => {
            if (!e.target.closest("a, button")) closeAll();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && closeAll()}
          aria-label="Close menu"
        >
          {forwarded && !deletedForEveryone && (
            <p className="text-[10px] uppercase tracking-wide opacity-80 mb-1">
              Forwarded
            </p>
          )}

          {scheduledLabel && !deletedForEveryone && (
            <div className="mb-1 flex items-center gap-1.5 text-[10px] opacity-90">
              <Clock size={12} className="shrink-0 opacity-90" />
              <span className="truncate">{scheduledLabel}</span>
            </div>
          )}

          {deletedForEveryone ? (
            <p className="italic text-sm opacity-80">
              This message was deleted
            </p>
          ) : (
            <>
              {/* TEXT */}
              {type === "text" && isEditing ? (
                <div className="max-w-[90%] flex flex-col gap-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="px-2 py-1.5 rounded-lg text-sm text-gray-900 dark:text-neutral-100 bg-white dark:bg-neutral-700/80 border border-gray-300 dark:border-neutral-600 outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                    className="text-[11px] font-medium opacity-90 hover:opacity-100 self-end"
                  >
                    Save
                  </button>
                </div>
              ) : type === "text" ? (
                <div className="max-w-[90%]">
                  {renderTextWithLinks(text, highlightQuery)}
                  {edited && (
                    <span className="text-[10px] opacity-80 italic ml-1">(edited)</span>
                  )}
                </div>
              ) : null}

              {/* IMAGE */}
              {type === "image" && file && (
                <img
                  src={file}
                  alt="sent"
                  loading="lazy"
                  className="rounded-[12px] sm:rounded-[14px] max-h-40 sm:max-h-48 md:max-h-56 object-cover w-full"
                />
              )}

              {/* VIDEO */}
              {type === "video" && file && (
                <video
                  src={file}
                  controls
                  className="rounded-[12px] sm:rounded-[14px] max-h-40 sm:max-h-48 md:max-h-56 w-full"
                />
              )}

              {/* FILE */}
              {type === "file" && file && (
                <a
                  href={file}
                  className="text-blue-300 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  📄 {text || "Download File"}
                </a>
              )}
            </>
          )}

          {/* TIME */}
          {time && (
          <div
            className={`text-[10px] opacity-70 mt-1 flex items-center gap-1.5 ${isOwn ? "justify-end text-right" : "justify-start text-left"}`}
          >
              <span>{time}</span>

            {isOwn && status !== "scheduled" && status !== "cancelled" && (
                <span
                  className={status === "seen" ? "text-blue-300" : "opacity-90"}
                  title={status === "seen" && seenAt ? `Seen at ${new Date(seenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : undefined}
                >
                  {status === "sent" && "✓"}
                  {status === "delivered" && "✓✓"}
                  {status === "seen" && "✓✓"}
                </span>
              )}
            </div>
          )}
          {isOwn && status === "seen" && seenAt && (
            <p className="text-[10px] opacity-70 mt-0.5 text-right">
              Seen at {new Date(seenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Reactions row */}
        {safeReactions.length > 0 && !deletedForEveryone && (
          <div className="flex gap-0.5 sm:gap-1 mt-1 justify-end flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <span
                key={emoji}
                className="px-1 sm:px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 text-[10px] sm:text-xs shadow border border-gray-200 dark:border-neutral-600"
              >
                {emoji} {count > 1 ? count : ""}
              </span>
            ))}
          </div>
        )}

        {/* Context menu */}
        {showMenu && (
          <MessageActionsMenu
            isOwn={isOwn}
            canEdit={!!(onSaveEdit && (type === "text" || !type) && !deletedForEveryone)}
            onEdit={handleStartEdit}
            onCopy={() => onCopy?.(id, text, file)}
            onDeleteForMe={() => onDeleteForMe?.(id)}
            onDeleteForEveryone={() => onDeleteForEveryone?.(id)}
            onCancelScheduled={
              isOwn && status === "scheduled"
                ? () => onDeleteForEveryone?.(id, { isScheduledCancel: true })
                : undefined
            }
            align={isOwn ? "right" : "left"}
            onReact={() => {
              setShowMenu(false);
              setShowPicker((prev) => !prev);
            }}
            onForward={() => onForward?.(id)}
            onClose={closeAll}
          />
        )}

        {/* Reaction picker */}
        {showPicker && (
          <ReactionPicker
            onSelect={(emoji) => {
              onReact?.(id, emoji);
              closeAll();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
