import React, { useEffect, useRef, useState } from "react";
import axios from "../../api/axios";
import { setMessageSoundEnabled } from "../../utils/messageSound";

const MessageSoundToggle = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const userId = storedUser?.id || storedUser?._id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchSetting = async () => {
      try {
        const res = await axios.get(`/message-sound/${userId}`);
        const value = !!res.data.messageSound;
        setEnabled(value);
        setMessageSoundEnabled(value);
      } catch (err) {
        console.error("Failed to load message sound setting", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSetting();
  }, []);

  const toggle = async () => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const userId = storedUser?.id || storedUser?._id;
    if (!userId) return;

    const next = !enabled;
    setEnabled(next);
    setMessageSoundEnabled(next);

    try {
      await axios.put(`/message-sound/${userId}`, { messageSound: next });

      // Play preview sound when enabling
      if (next && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Failed to update message sound setting", err);
    }
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">
        Message Sound
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-neutral-600"
          } ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
        {/* Simple preview sound; replace src with your own sound file if desired */}
        <audio
          ref={audioRef}
          src="https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3"
          preload="auto"
        />
      </div>
    </div>
  );
};

export default MessageSoundToggle;

