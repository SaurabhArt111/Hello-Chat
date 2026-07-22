import React, { useEffect, useState } from "react";
import Avatar from "../common/Avatar";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import { getCallHistory } from "../../api/calls";
import { useCall } from "../../context/CallContext";

const CallsPanel = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const { startCall: startCallFromContext } = useCall();

  useEffect(() => {
    loadCallHistory();
  }, []);

  const loadCallHistory = async () => {
    try {
      setLoading(true);
      const res = await getCallHistory();
      setCalls(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load call history:", err);
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCallBack = (call, type) => {
    const contactId = call.contactId ?? call.contact?._id;
    const contactName = call.contactName ?? call.contact?.username ?? "User";
    if (!contactId) return;
    startCallFromContext(type, contactId, contactName);
  };

  const getCallIcon = (direction, status) => {
    if (status === "missed") {
      return <PhoneMissed size={18} className="text-red-500" />;
    }
    if (direction === "incoming") {
      return <PhoneIncoming size={18} className="text-green-500" />;
    }
    return <PhoneOutgoing size={18} className="text-blue-500" />;
  };

  /** Format duration from seconds to "m:ss" or "0:00" */
  const formatDuration = (seconds) => {
    const s = Number(seconds) || 0;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  /** When the call happened: use startedAt, show day + time */
  const formatCallTime = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const now = new Date();
    const sameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    if (sameDay) return `Today ${timeStr}`;
    if (wasYesterday) return `Yesterday ${timeStr}`;
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }) + " " + timeStr;
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-white dark:bg-neutral-800/95 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-700 p-4 md:p-5">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-5 md:p-6 shadow-lg border border-gray-200 dark:border-neutral-700 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Call History</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Your recent calls</p>
      </div>

      {/* Calls List */}
      {loading ? (
        <div className="text-center py-8">
          <svg className="animate-spin h-8 w-8 text-emerald-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 dark:text-neutral-400 mt-2">Loading...</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 flex items-center justify-center">
            <Phone size={32} className="text-gray-400 dark:text-neutral-400" />
          </div>
          <p className="text-gray-500 dark:text-neutral-400">No call history</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <div
              key={call._id}
              className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-neutral-700 flex items-center justify-between hover:border-gray-300 dark:hover:border-neutral-600 transition-all duration-200"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar
                  name={call.contact?.username || call.contactName || "Unknown"}
                  src={call.contact?.avatar}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-gray-900 dark:text-neutral-100 truncate">
                      {call.contact?.username || call.contactName || "Unknown"}
                    </h3>
                    {getCallIcon(call.direction, call.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400 flex-wrap">
                    <span>{formatCallTime(call.startedAt)}</span>
                    <span>•</span>
                    <span>{formatDuration(call.duration)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {call.type === "video" ? (
                        <>
                          <Video size={12} />
                          Video
                        </>
                      ) : (
                        <>
                          <Phone size={12} />
                          Audio
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleCallBack(call, "audio")}
                  className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                  title="Audio call"
                >
                  <Phone size={18} />
                </button>
                <button
                  onClick={() => handleCallBack(call, "video")}
                  className="p-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                  title="Video call"
                >
                  <Video size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallsPanel;
