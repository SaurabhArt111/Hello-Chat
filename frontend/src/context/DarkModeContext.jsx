import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const ctx = useContext(DarkModeContext);
  if (!ctx) {
    throw new Error("useDarkMode must be used within DarkModeProvider");
  }
  return ctx;
};

const updateThemeClass = (isDark) => {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (isDark) {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
};

const getSystemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;

/**
 * Theme modes: "light" | "dark" | "system". `darkMode` (boolean) is kept
 * as a derived value for backward compatibility with existing consumers
 * that only care whether dark styling is currently active - it reflects
 * the OS preference live when themeMode is "system".
 */
export const DarkModeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState("light");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyMode = useCallback((mode) => {
    const isDark = mode === "system" ? getSystemPrefersDark() : mode === "dark";
    updateThemeClass(isDark);
    setDarkMode(isDark);
  }, []);

  // Initialize theme from localStorage, default to LIGHT.
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const initialMode =
      savedTheme === "dark" || savedTheme === "light" || savedTheme === "system"
        ? savedTheme
        : "light";

    if (!savedTheme) {
      localStorage.setItem("theme", "light");
    }

    setThemeModeState(initialMode);
    applyMode(initialMode);
    setLoading(false);
  }, [applyMode]);

  // While in "system" mode, keep in sync with live OS theme changes
  // (e.g. the device switches to dark mode at sunset) without a reload.
  useEffect(() => {
    if (themeMode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyMode("system");
    mql.addEventListener?.("change", handleChange);
    return () => mql.removeEventListener?.("change", handleChange);
  }, [themeMode, applyMode]);

  const setThemeMode = useCallback(
    (mode) => {
      if (!["light", "dark", "system"].includes(mode)) return;
      setThemeModeState(mode);
      applyMode(mode);
      localStorage.setItem("theme", mode);
    },
    [applyMode]
  );

  /** Back-compat: cycles light <-> dark (does not select "system" - use setThemeMode for that). */
  const toggleDarkMode = useCallback(() => {
    setThemeMode(darkMode ? "light" : "dark");
  }, [darkMode, setThemeMode]);

  const value = {
    darkMode,
    themeMode,
    setThemeMode,
    loading,
    toggleDarkMode,
  };

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
};
