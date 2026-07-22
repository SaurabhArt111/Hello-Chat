import React from "react";
import { Phone, Video } from "lucide-react";
import { useCall } from "../../context/CallContext";

export default function CallButtons({ receiverId, receiverName, isOnline }) {
  const { startCall, callState } = useCall();

  const busy = callState !== "idle";

  const handleAudioCall = () => {
    if (busy || !receiverId) return;
    startCall("audio", receiverId, receiverName);
  };

  const handleVideoCall = () => {
    if (busy || !receiverId) return;
    startCall("video", receiverId, receiverName);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleAudioCall}
        disabled={busy || !isOnline}
        className="p-2 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Audio call"
      >
        <Phone size={20} />
      </button>
      <button
        type="button"
        onClick={handleVideoCall}
        disabled={busy || !isOnline}
        className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Video call"
      >
        <Video size={20} />
      </button>
    </div>
  );
}
