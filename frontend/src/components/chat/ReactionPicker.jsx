import React from "react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const ReactionPicker = ({ onSelect }) => {
  return (
    <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 rounded-full shadow-xl border border-gray-200/60 dark:border-neutral-700/60 px-2 py-1 flex gap-1 text-lg">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="hover:scale-110 transition-transform focus:outline-none"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;

