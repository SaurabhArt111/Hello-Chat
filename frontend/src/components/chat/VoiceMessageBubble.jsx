import React, { useRef, useState, useEffect } from "react";
import { FiPlay, FiPause, FiDownload, FiFile, FiCheck } from "react-icons/fi";
import { Clock } from "lucide-react";
import MessageActionsMenu from "./MessageActionsMenu";

// Simple pub/sub so starting one voice note pauses any other one that's
// currently playing, instead of letting multiple play on top of each other.
const activePlayers = new Set();
function pauseOtherPlayers(except) {
  for (const pause of activePlayers) {
    if (pause !== except) pause();
  }
}

const VoiceMessageBubble = ({
  audioUrl,
  duration = 0,
  isOwn,
  time,
  id,
  status,
  seenAt,
  uploadProgress,
  onRetry,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onForward,
}) => {
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaFailed, setMediaFailed] = useState(false);
  const isSending = status === "sending";
  // Only ever seed this with a real, finite, positive number - a raw
  // `duration` prop of Infinity/NaN (both truthy!) is exactly what caused
  // the "Infinity:NaN" display bug previously: `Number(duration) || 0`
  // evaluates to Infinity, not 0, because Infinity is truthy.
  const safeInitialDuration = Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : 0;
  const [totalDuration, setTotalDuration] = useState(safeInitialDuration);
  const [durationUnknown, setDurationUnknown] = useState(safeInitialDuration === 0);

  useEffect(() => setMediaFailed(false), [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || mediaFailed) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      pauseOtherPlayers(pauseThis);
      const playPromise = audioRef.current.play();
      if (playPromise?.catch) {
        playPromise
          .then(() => setPlaying(true))
          .catch((err) => {
            console.error("Voice note playback failed:", err);
            setPlaying(false);
          });
      } else {
        setPlaying(true);
      }
    }
  };

  const pauseThis = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    setPlaying(false);
  };

  useEffect(() => {
    activePlayers.add(pauseThis);
    return () => activePlayers.delete(pauseThis);
  }, []);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => setShowMenu(true), 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!showMenu) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showMenu]);

  const handleSeek = (e) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio * 100);
    setCurrentTime(el.currentTime);
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      setProgress(el.duration && Number.isFinite(el.duration) ? (el.currentTime / el.duration) * 100 : 0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onError = () => setMediaFailed(true);
    // The bug behind "Infinity:NaN": some browsers (notably Chrome) report
    // `duration === Infinity` for webm/opus blobs recorded via
    // MediaRecorder, because the container's duration header is only
    // written properly once the file is finalized in a way Chrome
    // recognizes. `Infinity` is truthy and not NaN, so a naive
    // `if (el.duration && !isNaN(el.duration))` check (the previous code)
    // accepts it anyway. We now explicitly require a FINITE, positive
    // number, and apply the standard workaround for the Infinity case:
    // seeking near the end of the (unknown) timeline forces the browser
    // to compute the real duration, which then arrives via
    // `durationchange`.
    const acceptDuration = (value) => {
      if (Number.isFinite(value) && value > 0) {
        setTotalDuration(value);
        setDurationUnknown(false);
        return true;
      }
      return false;
    };
    const onLoadedMetadata = () => {
      if (acceptDuration(el.duration)) return;
      if (el.duration === Infinity) {
        setDurationUnknown(true);
        try {
          el.currentTime = 1e101; // forces duration recalculation in Chrome/Edge
        } catch {
          /* some browsers throw on out-of-range seeks - durationchange below still helps */
        }
      }
    };
    const onDurationChange = () => {
      if (acceptDuration(el.duration)) {
        // Undo the probing seek from onLoadedMetadata now that we know
        // the real duration, so playback doesn't jump to the end.
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("error", onError);
    };
  }, [audioUrl]);

  // Never render "Infinity" or "NaN" - if we genuinely don't know the
  // duration yet, show the live elapsed time once playing, or "0:00"
  // before that, instead of a broken/confusing value.
  const displaySecs = totalDuration > 0 ? totalDuration : durationUnknown ? currentTime : 0;
  const safeDisplaySecs = Number.isFinite(displaySecs) ? Math.max(0, displaySecs) : 0;
  const durationStr = `${Math.floor(safeDisplaySecs / 60)}:${String(Math.floor(safeDisplaySecs % 60)).padStart(2, "0")}`;

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = audioUrl.split("/").pop() || "voice-message";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(audioUrl, "_blank", "noopener");
    }
  };

  const bubbleClasses = `
    w-fit max-w-[280px] px-3 py-2 rounded-2xl shadow-md relative inline-block
    ${isOwn ? "ml-auto rounded-br-md bg-emerald-500 text-white" : "rounded-bl-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 border border-gray-200 dark:border-neutral-600"}
  `;

  return (
    <div className={`flex my-1 ${isOwn ? "justify-end" : "justify-start"} w-full px-1 sm:px-2`}>
      <div
        ref={containerRef}
        className="relative"
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
      <div className={bubbleClasses}>
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            playsInline
            disableRemotePlayback
            style={{ display: "none" }}
            aria-hidden
          />
          {mediaFailed ? (
            <div className="flex items-center gap-2 py-1 pr-2 min-w-[160px]">
              <FiFile className="opacity-70" />
              <span className="text-xs opacity-80">Voice message unavailable</span>
            </div>
          ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isSending}
              className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center shrink-0 focus:outline-none transition-colors disabled:cursor-default relative"
              aria-label={playing ? "Pause" : "Play"}
            >
              {isSending ? (
                <svg className="w-6 h-6 animate-spin opacity-90" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : playing ? (
                <FiPause size={18} />
              ) : (
                <FiPlay size={18} className="ml-0.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div
                className="h-1.5 bg-black/20 rounded-full overflow-hidden cursor-pointer"
                onClick={handleSeek}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <div
                  className="h-full bg-white/90 rounded-full transition-all duration-150"
                  style={{ width: `${isSending ? (uploadProgress || 0) : progress}%` }}
                />
              </div>
              <p className="text-[10px] opacity-80 mt-1">
                {isSending ? (Number.isFinite(uploadProgress) ? `Sending… ${uploadProgress}%` : "Sending…") : durationStr}
              </p>
            </div>
            {!isSending && (
              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-full hover:bg-black/20 transition-colors shrink-0"
                aria-label="Download voice message"
                title="Download"
              >
                <FiDownload size={14} />
              </button>
            )}
          </div>
          )}
          {time && (
            <div className={`text-[10px] opacity-70 mt-1 flex items-center gap-1.5 ${isOwn ? "justify-end text-right" : "justify-start text-left"}`}>
              <span>{time}</span>
              {isOwn && status !== "cancelled" && (
                <span className={status === "seen" ? "text-blue-300" : "opacity-90"}>
                  {status === "sending" && <Clock size={12} className="inline opacity-80" />}
                  {status === "sent" && <FiCheck size={13} className="inline" />}
                  {(status === "delivered" || status === "seen") && (
                    <span className="inline-flex -space-x-2">
                      <FiCheck size={13} />
                      <FiCheck size={13} />
                    </span>
                  )}
                  {status === "failed" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
                      className="text-red-200 underline text-[10px] font-medium"
                    >
                      Failed · Retry
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Context menu (no reactions for voice messages yet - React just closes the menu) */}
        {showMenu && (
          <MessageActionsMenu
            isOwn={isOwn}
            onCopy={() => onCopy?.(id, "", audioUrl)}
            onDeleteForMe={() => onDeleteForMe?.(id)}
            onDeleteForEveryone={() => onDeleteForEveryone?.(id)}
            align={isOwn ? "right" : "left"}
            onReact={() => setShowMenu(false)}
            onForward={() => onForward?.(id)}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>
    </div>
  );
};

export default VoiceMessageBubble;
