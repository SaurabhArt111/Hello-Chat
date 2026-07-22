import React, {
  createContext,
  useContext,
  useEffect,
  useState,
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

export const DarkModeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize theme from localStorage, default to LIGHT
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    
    if (!savedTheme) {
      // First time user → default LIGHT
      updateThemeClass(false);
      localStorage.setItem("theme", "light");
      setDarkMode(false);
    } else if (savedTheme === "dark") {
      updateThemeClass(true);
      setDarkMode(true);
    } else {
      updateThemeClass(false);
      setDarkMode(false);
    }
    
    setLoading(false);
  }, []);

  // Toggle theme and save to localStorage
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    updateThemeClass(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const value = {
    darkMode,
    loading,
    toggleDarkMode,
  };

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
};

