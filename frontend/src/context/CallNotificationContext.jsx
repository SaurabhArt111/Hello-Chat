import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import socket from "../socket";
import { useToastContext } from "./ToastContext";

const CallNotificationContext = createContext(null);

export function CallNotificationProvider({ children }) {
  const [missedCallCount, setMissedCallCount] = useState(0);
  const [lastMissedCallFrom, setLastMissedCallFrom] = useState(null);
  const toast = useToastContext();
  const processedMissedCallRef = useRef(new Set());

  useEffect(() => {
    const handleMissedCall = (data) => {
      // Create a unique key from callerId + timestamp to prevent duplicate toasts
      const key = `${data?.callerId || 'unknown'}-${Date.now()}`;
      
      // Prevent duplicate toasts within 2 seconds
      if (processedMissedCallRef.current.has(key)) {
        return;
      }
      processedMissedCallRef.current.add(key);
      
      // Clean up old keys after 2 seconds
      setTimeout(() => {
        processedMissedCallRef.current.delete(key);
      }, 2000);

      const callerName = data?.callerName ?? "Someone";
      setMissedCallCount((c) => c + 1);
      setLastMissedCallFrom(callerName);
      toast.info(`Missed call from ${callerName}`);
    };

    socket.on("missed_call", handleMissedCall);
    return () => socket.off("missed_call", handleMissedCall);
  }, [toast]);

  const clearMissedCallBadge = () => {
    setMissedCallCount(0);
    setLastMissedCallFrom(null);
  };

  const value = {
    missedCallCount,
    lastMissedCallFrom,
    clearMissedCallBadge,
  };

  return (
    <CallNotificationContext.Provider value={value}>
      {children}
    </CallNotificationContext.Provider>
  );
}

export function useCallNotification() {
  const ctx = useContext(CallNotificationContext);
  return ctx ?? { missedCallCount: 0, lastMissedCallFrom: null, clearMissedCallBadge: () => {} };
}
