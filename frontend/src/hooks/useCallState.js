import { useEffect, useMemo, useRef, useState } from "react";
import { CALL_STATES } from "../constants/callTheme";

export default function useCallState({
  rawState,
  callType,
  incomingCaller,
  remoteUser,
  endCall,
}) {
  const [endedCallMeta, setEndedCallMeta] = useState(null);
  const [isAppBackground, setIsAppBackground] = useState(false);
  const activeStartRef = useRef(null);
  const previousRawRef = useRef(rawState);

  const mappedState = useMemo(() => {
    if (rawState === "incoming") return CALL_STATES.RINGING;
    if (rawState === "calling") return CALL_STATES.CONNECTING;
    if (rawState === "connected") return CALL_STATES.ACTIVE;
    return CALL_STATES.IDLE;
  }, [rawState]);

  useEffect(() => {
    if (rawState === "connected" && previousRawRef.current !== "connected") {
      activeStartRef.current = Date.now();
    }
    if (rawState === "idle" && previousRawRef.current !== "idle") {
      const elapsedMs =
        activeStartRef.current != null ? Date.now() - activeStartRef.current : 0;
      const durationSec = Math.max(0, Math.floor(elapsedMs / 1000));
      window.setTimeout(() => {
        setEndedCallMeta({
          durationSec,
          person: remoteUser || incomingCaller,
          type: callType || "audio",
        });
      }, 0);
      activeStartRef.current = null;
    }
    previousRawRef.current = rawState;
  }, [rawState, remoteUser, incomingCaller, callType]);

  useEffect(() => {
    const handleVisibility = () => setIsAppBackground(document.hidden);
    const handlePageHide = () => {
      if (rawState === "connected") endCall();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [rawState, endCall]);

  const dismissEnded = () => setEndedCallMeta(null);

  return {
    mappedState,
    endedCallMeta,
    dismissEnded,
    isAppBackground,
  };
}
