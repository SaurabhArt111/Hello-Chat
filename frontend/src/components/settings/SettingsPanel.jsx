import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DarkModeToggle from "./DarkModeToggle";
import NotificationToggle from "./NotificationToggle";
import MessageSoundToggle from "./MessageSoundToggle";
import LanguageSelector from "./LanguageSelector";
import LastSeenPrivacy from "./LastSeenPrivacy";
import ProfilePhotoPrivacy from "./ProfilePhotoPrivacy";
import DeleteAccountModal from "./DeleteAccountModal";

const SettingsPanel = ({ onClose }) => {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="w-full md:w-[360px] h-full">
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5 flex flex-col">

        {/* Header */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 md:p-6 shadow-lg border border-gray-200 dark:border-neutral-700 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            ✕
          </button>

          <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Settings</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Manage your preferences</p>
        </div>

        {/* General Settings */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-neutral-700 mt-4 space-y-5">

          {/* Dark Mode */}
          <DarkModeToggle />

          {/* Notifications */}
          <NotificationToggle />

          {/* Sound */}
          <MessageSoundToggle />

          {/* Translation language */}
          <LanguageSelector />

        </div>

        {/* Privacy */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-neutral-700 mt-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Privacy</h3>

          <LastSeenPrivacy />

          <ProfilePhotoPrivacy />
        </div>

      {/* Logout Section */}
      <div className="mt-6">
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
        >
          Logout
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="mt-3 w-full rounded-xl border border-red-300 bg-red-50 py-3 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100"
        >
          Permanently delete account
        </button>
      </div>

      </div>
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
};

export default SettingsPanel;
