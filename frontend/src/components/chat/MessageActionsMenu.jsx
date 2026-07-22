import React from "react";

const MessageActionsMenu = ({
  isOwn,
  canEdit = false,
  onEdit,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onCancelScheduled,
  onReact,
  onForward,
  onClose,
  align = "right", // "left" | "right"
}) => {
  const pos =
    align === "left"
      ? "left-full ml-2 origin-center-left"
      : "right-full mr-2 origin-center-right";
  return (
    <div
      className={`absolute z-50 ${pos} top-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 text-[12px] text-gray-800 dark:text-neutral-100 min-w-[180px] max-w-[90vw] overflow-hidden`}
    >
      {canEdit && onEdit && (
        <button
          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          onClick={() => onEdit()}
        >
          Edit message
        </button>
      )}
      <button
        className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors ${!canEdit ? "" : ""}`}
        onClick={() => { onCopy(); onClose(); }}
      >
        Copy
      </button>
      <div className="h-px bg-gray-200 dark:bg-neutral-700" />
      <button
        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        onClick={() => { onDeleteForMe(); onClose(); }}
      >
        Delete for me
      </button>
      {isOwn && onCancelScheduled && (
        <button
          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          onClick={() => { onCancelScheduled(); onClose(); }}
        >
          Cancel scheduled send
        </button>
      )}
      {isOwn && !onCancelScheduled && (
        <button
          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          onClick={() => { onDeleteForEveryone(); onClose(); }}
        >
          Delete for everyone
        </button>
      )}
      <div className="h-px bg-gray-200 dark:bg-neutral-700" />
      <button
        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        onClick={() => { onReact(); onClose(); }}
      >
        React
      </button>
      <button
        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        onClick={() => { onForward(); onClose(); }}
      >
        Forward
      </button>
    </div>
  );
};

export default MessageActionsMenu;

