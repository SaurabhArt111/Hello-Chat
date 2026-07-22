import React, { useRef, useState, useEffect } from "react";

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
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
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
              <span className="text-lg">⏸</span>
            ) : (
              <span className="text-lg ml-0.5">▶</span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/90 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] opacity-80 mt-1">{durationStr}</p>
          </div>
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
