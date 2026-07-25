import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useDarkMode } from "../../context/DarkModeContext";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const DarkModeToggle = () => {
  const { themeMode, loading, setThemeMode } = useDarkMode();

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
          Theme
        </span>
        <span className="text-xs text-gray-500 dark:text-neutral-400">
          {themeMode === "system" ? "Matches your device setting" : themeMode === "dark" ? "Dark" : "Light"}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Theme"
        className={`grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-neutral-800 p-1 ${
          loading ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = themeMode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={loading}
              onClick={() => setThemeMode(value)}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DarkModeToggle;
