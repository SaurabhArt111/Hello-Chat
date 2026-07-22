import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

const TranslationContext = createContext(null);

/**
 * Two-level control:
 * - globalShowTranslated: affects all received messages (default true = show translated)
 * - messageOverrides: { [messageId]: true/false } — per-message override; when set, that message ignores global
 */
export function TranslationProvider({ children }) {
  const [globalShowTranslated, setGlobalShowTranslated] = useState(true);
  const [messageOverrides, setMessageOverrides] = useState({});

  const toggleGlobalTranslation = useCallback(() => {
    setGlobalShowTranslated((prev) => !prev);
  }, []);

  /** Normalize id so ObjectId and string match in overrides. */
  const normId = useCallback((messageId) =>
    messageId == null ? null : String(messageId), []);

  /** For a given message: if it has an override, use it; else use global. */
  const getShowTranslated = useCallback(
    (messageId) => {
      const id = normId(messageId);
      if (id == null) return globalShowTranslated;
      if (Object.prototype.hasOwnProperty.call(messageOverrides, id)) {
        return messageOverrides[id];
      }
      return globalShowTranslated;
    },
    [globalShowTranslated, messageOverrides, normId]
  );

  /** Toggle display for one message (override). Pass current effective value so we flip it. */
  const toggleMessageTranslation = useCallback((messageId, currentShowTranslated) => {
    const id = normId(messageId);
    if (id == null) return;
    setMessageOverrides((prev) => ({
      ...prev,
      [id]: !currentShowTranslated,
    }));
  }, [normId]);

  const value = useMemo(
    () => ({
      globalShowTranslated,
      messageOverrides,
      toggleGlobalTranslation,
      toggleMessageTranslation,
      getShowTranslated,
    }),
    [
      globalShowTranslated,
      messageOverrides,
      toggleGlobalTranslation,
      toggleMessageTranslation,
      getShowTranslated,
    ]
  );

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within TranslationProvider");
  }
  return ctx;
}
