import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar } from "lucide-react";
import { scheduleMessage } from "../../api/scheduledMessages";
import { useToastContext } from "../../context/ToastContext";

const ScheduleMessageModal = ({ isOpen, onClose, receiverId, groupId, onScheduled, initialText = "" }) => {
  const [text, setText] = useState(initialText);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToastContext();

  // Set default to tomorrow at 9 AM
  React.useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      const dateStr = tomorrow.toISOString().split("T")[0];
      const timeStr = tomorrow.toTimeString().slice(0, 5);
      
      setScheduledDate(dateStr);
      setScheduledTime(timeStr);
      if (initialText) {
        setText(initialText);
      }
    } else {
      setText("");
    }
  }, [isOpen, initialText]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!text.trim()) {
      toast.error("Message text is required");
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast.error("Please select date and time");
      return;
    }

    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    
    if (scheduledDateTime <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setLoading(true);
    try {
      const res = await scheduleMessage({
        receiver: receiverId,
        group: groupId,
        text: text.trim(),
        scheduledFor: scheduledDateTime.toISOString(),
      });

      const scheduledMsg = res?.data?.scheduledMessage || null;
      onScheduled?.(scheduledMsg, scheduledDateTime);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule message");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-neutral-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <Clock className="text-emerald-500" size={20} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">
                Schedule Message
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Message Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Message *
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message..."
                rows="4"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                required
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Calendar size={16} />
                  Date *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                  <Clock size={16} />
                  Time *
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Preview */}
            {scheduledDate && scheduledTime && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Message will be sent on{" "}
                  <span className="font-semibold">
                    {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                  </span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-200 dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 font-medium hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Scheduling..." : "Schedule"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ScheduleMessageModal;
