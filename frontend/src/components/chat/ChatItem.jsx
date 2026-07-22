import React from "react";
import Avatar from "../common/Avatar";


const ChatItem = ({
  name = "User Name",
  message = "Last message preview...",
  time = "12:45",
  active = false,
  online = false,
  avatar,
}) => {

  return (
    <div
      className={`flex items-center gap-3 px-3 md:px-4 py-3.5 cursor-pointer transition-all duration-200 rounded-xl mx-2 md:mx-3 my-1 border border-transparent
      ${active
        ? "bg-gray-100 dark:bg-neutral-800 ring-1 ring-emerald-500/60 shadow-md"
        : "hover:bg-gray-50 dark:hover:bg-neutral-700/50 hover:border-gray-300 dark:hover:border-neutral-600"
      }`}
    >
      <Avatar name={name} src={avatar} size="lg" online={online} />

      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-sm truncate ${active ? "text-gray-900 dark:text-neutral-100" : "text-gray-900 dark:text-neutral-100"}`}>{name}</h4>
        <p className="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">
          {message}
        </p>
      </div>

      <span className={`text-xs flex-shrink-0 ${active ? "text-emerald-500 dark:text-emerald-400 font-medium" : "text-gray-500 dark:text-neutral-500"}`}>{time}</span>
    </div>
  );
};

export default ChatItem;
