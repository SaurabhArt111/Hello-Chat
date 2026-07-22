import { useEffect, useMemo, useRef, useState } from "react";

export default function useCallTimer(isRunning) {
  const [tick, setTick] = useState(0);
  const startedAtRef = useRef(null);

  if (isRunning && startedAtRef.current == null) startedAtRef.current = Date.now();
  if (!isRunning && startedAtRef.current != null) startedAtRef.current = null;

  useEffect(() => {
    if (!isRunning) return undefined;
    const interval = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const seconds = startedAtRef.current
    ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
    : 0;

  const formatted = useMemo(() => {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [seconds, tick]);

  return { seconds, formatted };
}
