import React from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Users,
  Phone,
  Settings,
  Bell,
  UserPlus
} from "lucide-react";
import NotificationBadge from "../notifications/NotificationBadge";
import { useNotificationContext } from "../../context/NotificationContext";
import { useCallNotification } from "../../context/CallNotificationContext";

const SidebarIcons = ({
  activeView = "chats",
  onViewChange,
  onProfileClick,
  onSettingsClick,
  onUsersClick,
  onRequestsClick,
  onCallsClick,
  onChatsClick,
  onContactsClick
}) => {
  const { unreadCount } = useNotificationContext();
  const { missedCallCount, clearMissedCallBadge } = useCallNotification();

  const iconClass = (name) =>
    `p-3 rounded-xl transition-all duration-200 cursor-pointer ${activeView === name
      ? "bg-gray-100 dark:bg-neutral-800 text-emerald-500 dark:text-emerald-400 shadow-md ring-1 ring-emerald-500/50"
      : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700/80 hover:text-emerald-500 dark:hover:text-emerald-400"
    }`;

  return (
    <div className="w-full bg-white dark:bg-neutral-800/95 backdrop-blur-sm flex flex-col items-center py-3 md:py-5 justify-between border-r border-gray-200 dark:border-neutral-700 h-full shadow-lg">

      {/* Top */}
      <div className="flex flex-col items-center gap-5">

        {/* Logo */}
        <motion.div
          className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md cursor-pointer border border-gray-200 dark:border-neutral-700"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-white font-bold text-xl">T</span>
        </motion.div>

        {/* Icons */}
        <div className="flex flex-col gap-4 mt-4">

          <motion.button
            title="Chats"
            onClick={() => { onViewChange("chats"); onChatsClick?.(); }}
            className={iconClass("chats")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageCircle size={22} />
          </motion.button>

          <motion.button
            title="Contacts"
            onClick={() => { onViewChange("contacts"); onContactsClick?.(); }}
            className={iconClass("contacts")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Users size={22} />
          </motion.button>

          <motion.button
            title="Calls"
            onClick={() => { clearMissedCallBadge(); onViewChange("calls"); onCallsClick?.(); }}
            className={`${iconClass("calls")} relative`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Phone size={22} />
            {missedCallCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {missedCallCount > 99 ? "99+" : missedCallCount}
              </span>
            )}
          </motion.button>

          <motion.button
            title="Settings"
            onClick={onSettingsClick}
            className="p-3 rounded-xl transition-all duration-200 cursor-pointer text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700/80 hover:text-gray-900 dark:hover:text-neutral-100"
            whileTap={{ scale: 0.95 }}
          >
            <Settings size={22} />
          </motion.button>

        </div>
      </div>

      {/* Middle - Notifications and Add Users */}
      <div className="flex flex-col gap-3">
        <motion.button
          onClick={onRequestsClick}
          className="relative w-11 h-11 rounded-xl bg-neutral-700/80 cursor-pointer hover:bg-neutral-600 flex items-center justify-center transition-all duration-200 group border border-neutral-600 hover:border-neutral-500"
          title="Friend Requests"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Bell size={20} className="text-neutral-300 group-hover:text-white transition-colors" />
          <NotificationBadge count={unreadCount} />
        </motion.button>

        <motion.button
          onClick={onUsersClick}
          className="w-11 h-11 rounded-xl bg-neutral-700/80 cursor-pointer hover:bg-neutral-600 flex items-center justify-center transition-all duration-200 group border border-neutral-600 hover:border-neutral-500"
          title="Discover People"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <UserPlus size={20} className="text-neutral-300 group-hover:text-white transition-colors" />
        </motion.button>
      </div>

      {/* Profile */}
      <motion.div
        onClick={onProfileClick}
        className="w-11 h-11 rounded-full bg-emerald-500 cursor-pointer flex items-center justify-center border-2 border-neutral-700 shadow-md hover:bg-emerald-400 transition-all duration-200"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="Profile"
      >
        <span className="text-white text-lg">👤</span>
      </motion.div>

    </div>
  );
};

export default SidebarIcons;
