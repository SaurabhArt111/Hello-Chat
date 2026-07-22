import React from "react";
import { useDarkMode } from "../../context/DarkModeContext";

const DarkModeToggle = () => {
  const { darkMode, loading, toggleDarkMode } = useDarkMode();

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
          Dark Mode
        </span>
        <span className="text-xs text-gray-500 dark:text-neutral-400">
          {darkMode ? "Enabled" : "Disabled"}
        </span>
      </div>

      <button
        type="button"
        onClick={toggleDarkMode}
        disabled={loading}
        role="switch"
        aria-checked={darkMode}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          darkMode
            ? "bg-emerald-500"
            : "bg-gray-300 dark:bg-neutral-600"
        } ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            darkMode ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
};

export default DarkModeToggle;

