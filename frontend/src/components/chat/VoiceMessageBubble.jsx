import React, { useRef, useState, useEffect } from "react";
import { FiPlay, FiPause, FiDownload } from "react-icons/fi";

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
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onForward,
}) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(Number(duration) || 0);

  const togglePlay = () => {
    if (!audioRef.current) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeek = (e) => {
    const el = audioRef.current;
    if (!el || !el.duration || isNaN(el.duration)) return;
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
      setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onLoadedMetadata = () => {
      if (el.duration && !isNaN(el.duration)) setTotalDuration(el.duration);
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [audioUrl]);

  const displaySecs = totalDuration > 0 ? totalDuration : duration || 0;
  const durationStr = `${Math.floor(displaySecs / 60)}:${String(Math.floor(displaySecs % 60)).padStart(2, "0")}`;

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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center shrink-0 focus:outline-none transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
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
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] opacity-80 mt-1">{durationStr}</p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-full hover:bg-black/20 transition-colors shrink-0"
            aria-label="Download voice message"
            title="Download"
          >
            <FiDownload size={14} />
          </button>
        </div>
        {time && (
          <p className={`text-[10px] opacity-70 mt-1 ${isOwn ? "text-right" : "text-left"}`}>
            {time}
          </p>
        )}
      </div>
    </div>
  );
};

export default VoiceMessageBubble;
