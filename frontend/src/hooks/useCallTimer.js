import { useEffect, useMemo, useRef, useState } from "react";

export default function useCallTimer(isRunning) {
  const [seconds, setSeconds] = useState(0);
  const startedAtRef = useRef(null);

  useEffect(() => {
    if (!isRunning) {
      startedAtRef.current = null;
      setSeconds(0);
      return undefined;
    }
    startedAtRef.current = Date.now();
    setSeconds(0);
    const interval = window.setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const formatted = useMemo(() => {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [seconds]);

  return { seconds, formatted };
}
