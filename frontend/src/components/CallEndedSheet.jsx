import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageSquare, ArrowLeft } from "lucide-react";
import { callTheme } from "../constants/callTheme";

const MotionDiv = motion.div;

function formatDuration(durationSec = 0) {
  const mm = Math.floor(durationSec / 60);
  const ss = durationSec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function CallEndedSheet({
  open,
  durationSec,
  onCallAgain,
  onSendMessage,
  onBackToChat,
}) {
  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut" } }}
        >
          <MotionDiv
            className="w-full max-w-lg rounded-t-3xl p-6 text-white"
            style={{ ...callTheme.controlStyles, borderRadius: "24px 24px 0 0" }}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0, transition: { duration: 0.4, ease: "easeOut" } }}
          >
            <h3 className="text-2xl font-semibold">Call Ended</h3>
            <p className="mt-1 text-white/70">Duration {formatDuration(durationSec)}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={onCallAgain}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10"
              >
                <Phone size={18} />
                <span className="text-xs">Call Again</span>
              </button>
              <button
                type="button"
                onClick={onSendMessage}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10"
              >
                <MessageSquare size={18} />
                <span className="text-xs">Send Message</span>
              </button>
              <button
                type="button"
                onClick={onBackToChat}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10"
              >
                <ArrowLeft size={18} />
                <span className="text-xs">Back to Chat</span>
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
