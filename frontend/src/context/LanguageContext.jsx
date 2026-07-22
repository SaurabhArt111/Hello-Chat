import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "../api/axios";

const LanguageContext = createContext(null);

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "gu", name: "Gujarati" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

export function LanguageProvider({ children }) {
  const [preferredLanguage, setPreferredLanguageState] = useState("en");
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(true);

  const userId = () => {
    if (typeof window === "undefined") return null;
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.id || user?._id;
  };

  const fetchLanguage = useCallback(async () => {
    const id = userId();
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await axios.get(`/user/language/${id}`);
      setPreferredLanguageState(data.preferredLanguage || "en");
    } catch (err) {
      console.error("Failed to fetch language preference:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLanguage();
  }, [fetchLanguage]);

  const setPreferredLanguage = useCallback((lang) => {
    setPreferredLanguageState(lang);
  }, []);

  const toggleOriginalText = useCallback(() => {
    setShowOriginal((prev) => !prev);
  }, []);

  const value = {
    preferredLanguage,
    showOriginal,
    setPreferredLanguage,
    toggleOriginalText,
    refreshLanguage: fetchLanguage,
    loading,
    LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
