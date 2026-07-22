import React, { useState } from "react";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionPicker from "./ReactionPicker";

const urlRegex = /(https?:\/\/\S+)/gi;

const renderTextWithLinks = (text) => {
  if (!text) return null;
  const parts = text.split(urlRegex);
  return (
    <p className="leading-relaxed">
      {parts.map((part, idx) =>
        urlRegex.test(part) ? (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 dark:text-blue-400 underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </p>
  );
};

/**
 * Renders a text message with optional original/translated toggle.
 * - originalText: raw message text
 * - translatedText: translated version (can be same as original if no translation)
 */
export default function TranslatedMessage({
  id,
  text,
  originalText,
  translatedText,
  isOwn,
  type = "text",
  file,
  time,
  status,
  reactions = [],
  forwarded = false,
  deletedForEveryone = false,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onForward,
  globalShowOriginal = false,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Per-message override: when set, this message uses localShowOriginal instead of global
  const [localOverride, setLocalOverride] = useState(false);
  const [localShowOriginal, setLocalShowOriginal] = useState(false);

  const hasTranslation =
    translatedText != null &&
    translatedText !== "" &&
    String(translatedText).trim() !== String(originalText ?? text ?? "").trim();
  const original = originalText ?? text ?? "";
  const translated = translatedText ?? text ?? original;

  // Header toggle = global for all. Per-message button = override for this message only.
  const showOriginal = hasTranslation
    ? (localOverride ? localShowOriginal : globalShowOriginal)
    : false;
  const displayText = showOriginal ? original : translated;

  const handlePerMessageToggle = () => {
    setLocalOverride(true);
    setLocalShowOriginal((prev) => !prev);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const groupedReactions = Array.isArray(reactions)
    ? reactions.reduce((acc, r) => {
      const emoji = r?.emoji ?? r;
      if (!acc[emoji]) acc[emoji] = 0;
      acc[emoji] += 1;
      return acc;
    }, {})
    : {};

  const bubbleClasses = `
    px-4 md:px-5 py-2.5 rounded-2xl shadow-lg max-w-[85%] md:max-w-xs text-sm relative
    ${isOwn
      ? "bg-gradient-to-br from-purple-600 to-pink-500 text-white ml-auto"
      : "bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-gray-800 dark:text-white border border-gray-200/50 dark:border-slate-700/50"
    }
  `;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="relative" onContextMenu={handleContextMenu}>
        <div className={bubbleClasses}>
          {forwarded && !deletedForEveryone && (
            <p className="text-[10px] uppercase tracking-wide text-gray-300 dark:text-gray-400 mb-1">
              Forwarded
            </p>
          )}

          {deletedForEveryone ? (
            <p className="italic text-gray-300 dark:text-gray-400">
              This message was deleted
            </p>
          ) : (
            <>
              {type === "text" && renderTextWithLinks(displayText)}

              {type === "image" && file && (
                <img
                  src={file}
                  alt="sent"
                  loading="lazy"
                  className="rounded-lg max-h-48 object-cover"
                />
              )}

              {type === "video" && file && (
                <video
                  src={file}
                  controls
                  className="rounded-lg max-h-48"
                />
              )}

              {type === "file" && file && (
                <a
                  href={file}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  📄 {text || "Download File"}
                </a>
              )}
            </>
          )}

          {type === "text" && hasTranslation && !deletedForEveryone && (
            <button
              type="button"
              onClick={handlePerMessageToggle}
              className={`
                mt-2 block text-[10px] font-medium underline focus:outline-none
                ${isOwn ? "text-white/90 hover:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}
              `}
            >
              {showOriginal ? "Show Translation" : "Show Original"}
            </button>
          )}

          {time && (
            <div
              className={`
                text-[10px] mt-2 flex items-center justify-end gap-1.5
                ${isOwn ? "text-white/90" : "text-gray-500 dark:text-gray-400"}
              `}
            >
              <span>{time}</span>
              {isOwn && (
                <span
                  className={`
                    text-xs
                    ${status === "seen" ? "text-blue-400" : "text-white/80"}
                  `}
                >
                  {status === "sent" && "✓"}
                  {status === "delivered" && "✓✓"}
                  {status === "seen" && "✓✓"}
                </span>
              )}
            </div>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 && !deletedForEveryone && (
          <div className="flex gap-1 mt-1 justify-end">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <span
                key={emoji}
                className="px-1.5 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-xs shadow border border-gray-200/60 dark:border-slate-700/60"
              >
                {emoji} {count > 1 ? count : ""}
              </span>
            ))}
          </div>
        )}

        {showMenu && (
          <MessageActionsMenu
            isOwn={isOwn}
            onCopy={() => onCopy?.(id, displayText)}
            onDeleteForMe={() => onDeleteForMe?.(id)}
            onDeleteForEveryone={() => onDeleteForEveryone?.(id)}
            align={isOwn ? "right" : "left"}
            onReact={() => {
              setShowMenu(false);
              setShowPicker((prev) => !prev);
            }}
            onForward={() => onForward?.(id)}
            onClose={() => setShowMenu(false)}
          />
        )}

        {showPicker && (
          <ReactionPicker
            onSelect={(emoji) => {
              onReact?.(id, emoji);
              setShowPicker(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
