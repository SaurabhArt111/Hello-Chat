import React, { useState, useRef, useEffect } from "react";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionPicker from "./ReactionPicker";
import { useTranslation } from "../../context/TranslationContext";

const urlRegex = /(https?:\/\/\S+)/gi;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderTextWithLinks = (text, highlightQuery = "") => {
  if (!text) return null;
  const parts = text.split(urlRegex);
  const wrapHighlight = (str, keyPrefix) => {
    if (!str || !highlightQuery) return <span key={keyPrefix}>{str}</span>;
    const bits = [];
    let lastIndex = 0;
    const re = new RegExp(escapeRegex(highlightQuery), "gi");
    let match;
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
    <p className="text-sm leading-tight break-words">
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

/**
 * Used only for RECEIVED messages. Shows originalText / translatedText with toggle.
 * Sent messages always use MessageBubble (original only).
 */
export default function TranslatedMessageBubble({
  message,
  highlightQuery = "",
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onForward,
  onTranslateRequest,
}) {
  const { getShowTranslated, toggleMessageTranslation } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [translating, setTranslating] = useState(false);
  const longPressTimerRef = useRef(null);
  const containerRef = useRef(null);

  const closeAll = () => {
    setShowMenu(false);
    setShowPicker(false);
  };

  const id = message._id != null ? String(message._id) : null;
  const originalText = String(message.originalText ?? message.text ?? "").trim() || "";
  const translatedText = String(message.translatedText ?? message.text ?? originalText).trim() || originalText;
  const hasTranslation =
    translatedText !== "" &&
    originalText !== "" &&
    translatedText !== originalText;

  const isText = (message.type || "text") === "text";

  const canRequestTranslation =
    isText &&
    originalText !== "" &&
    !hasTranslation &&
    typeof onTranslateRequest === "function";

  const handleRequestTranslation = () => {
    if (!id || translating || !originalText) return;
    setTranslating(true);
    onTranslateRequest(id, originalText).finally(() => setTranslating(false));
  };

  const showTranslated = getShowTranslated(id ?? message._id);
  const displayText = (hasTranslation
    ? showTranslated
      ? translatedText
      : originalText
    : originalText) || message.text || "";

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

  const groupedReactions = Array.isArray(message.reactions)
    ? message.reactions.reduce((acc, r) => {
        const emoji = r?.emoji ?? r;
        if (!acc[emoji]) acc[emoji] = 0;
        acc[emoji] += 1;
        return acc;
      }, {})
    : {};

  const bubbleClasses =
    "max-w-[600px] min-w-0 w-fit px-3 py-2 text-sm leading-snug break-words rounded-2xl rounded-bl-md shadow-md relative inline-block bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 border border-gray-200 dark:border-neutral-600";

  return (
    <div className="flex justify-start w-full px-1 sm:px-2">
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
          {message.forwarded && !message.deletedForEveryone && (
            <p className="text-[10px] uppercase tracking-wide opacity-80 mb-1">
              Forwarded
            </p>
          )}

          {message.deletedForEveryone ? (
            <p className="italic text-sm opacity-80">
              This message was deleted
            </p>
          ) : (
            <>
              {isText && (
                <div className="max-w-[90%]">
                  {renderTextWithLinks(displayText, highlightQuery)}
                </div>
              )}

              {message.type === "image" && message.file && (
                <img
                  src={message.file}
                  alt="sent"
                  loading="lazy"
                  className="rounded-[12px] sm:rounded-[14px] max-h-40 sm:max-h-48 md:max-h-56 object-cover w-full"
                />
              )}

              {message.type === "video" && message.file && (
                <video
                  src={message.file}
                  controls
                  className="rounded-[12px] sm:rounded-[14px] max-h-40 sm:max-h-48 md:max-h-56 w-full"
                />
              )}

              {message.type === "file" && message.file && (
                <a
                  href={message.file}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  📄 {message.text || "Download File"}
                </a>
              )}
            </>
          )}

          {isText && !message.deletedForEveryone && (
            <>
              {hasTranslation && (
                <button
                  type="button"
                  onClick={() => toggleMessageTranslation(id ?? message._id, showTranslated)}
                  className="mt-1.5 block text-[10px] font-medium underline focus:outline-none opacity-80 hover:opacity-100"
                >
                  {showTranslated ? "Show original" : "Show translation"}
                </button>
              )}
              {canRequestTranslation && (
                <button
                  type="button"
                  onClick={handleRequestTranslation}
                  disabled={translating}
                  className="mt-1.5 block text-[10px] font-medium underline focus:outline-none opacity-80 hover:opacity-100 disabled:opacity-50"
                >
                  {translating ? "Translating…" : "Translate"}
                </button>
              )}
            </>
          )}

          {message.time && (
            <div className="text-[10px] opacity-70 mt-1 text-left">
              <span>{message.time}</span>
            </div>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 && !message.deletedForEveryone && (
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

        {showMenu && (
          <MessageActionsMenu
            isOwn={false}
            onCopy={() => onCopy?.(id, displayText, message.file)}
            onDeleteForMe={() => onDeleteForMe?.(id)}
            onDeleteForEveryone={() => onDeleteForEveryone?.(id)}
            align="left"
            onReact={() => {
              setShowMenu(false);
              setShowPicker((prev) => !prev);
            }}
            onForward={() => onForward?.(id)}
            onClose={closeAll}
          />
        )}

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
}
