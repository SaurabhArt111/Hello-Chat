import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { callTheme } from "../constants/callTheme";
import { buttonPressSpring, ripplePulse } from "../animations/callAnimations";

const MotionDiv = motion.div;
const MotionButton = motion.button;

function hapticImpact() {
  if (navigator.vibrate) navigator.vibrate([20, 10, 30]);
}

export default function IncomingCallModal({
  isVisible,
  callerName,
  relationTag = "Contact",
  onDecline,
  onAcceptAudio,
  onAcceptVideo,
  isForeground = true,
}) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isVisible) return undefined;
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    }

    if (!isForeground && "Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("Incoming call", {
        body: `${callerName} is calling`,
        silent: false,
      });
      notification.onclick = () => window.focus();
      return () => notification.close();
    }

    return undefined;
  }, [isVisible, callerName, isForeground]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-xl">
      <audio
        ref={audioRef}
        src="https://assets.mixkit.co/active_storage/sfx/2562-ring-tone-1.mp3"
        loop
      />
      <MotionDiv className="relative w-full max-w-md px-6 py-10 text-center text-white">
        {/* Waveform rings behind avatar */}
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          {[0, 1, 2].map((index) => (
            <MotionDiv
              key={index}
              className="absolute rounded-full border border-white/20"
              style={{ width: 160, height: 160, left: -80, top: -80 }}
              {...ripplePulse}
              transition={{ ...ripplePulse.animate.transition, delay: index * 0.2 }}
            />
          ))}
        </div>

        <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-3xl">
          {callerName?.slice(0, 1)?.toUpperCase() || "U"}
        </div>
        <h2 className="text-[28px] font-semibold">{callerName}</h2>
        <p className="text-sm text-white/70">{relationTag}</p>
        <p className="mt-2 text-sm text-white/60">Swipe up to answer</p>

        <MotionDiv
          drag
          dragConstraints={{ left: -140, right: 140, top: -120, bottom: 0 }}
          onDrag={(_, info) => {
            setDragX(info.offset.x);
            setDragY(info.offset.y);
          }}
          onDragEnd={() => {
            if (dragX < -90) {
              hapticImpact();
              onDecline();
            } else if (dragX > 90 || dragY < -70) {
              hapticImpact();
              onAcceptAudio();
            }
            setDragX(0);
            setDragY(0);
          }}
          className="mt-10 flex items-center justify-between gap-4 rounded-[36px] p-3"
          style={callTheme.controlStyles}
        >
          <MotionButton
            type="button"
            onClick={() => {
              hapticImpact();
              onDecline();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white"
            style={{ background: callTheme.colors.dangerAction }}
            aria-label="Decline call"
            {...buttonPressSpring}
          >
            <PhoneOff />
          </MotionButton>

          <MotionButton
            type="button"
            onClick={() => {
              hapticImpact();
              onAcceptAudio();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white"
            style={{ background: callTheme.colors.primaryAction }}
            aria-label="Accept audio call"
            {...buttonPressSpring}
          >
            <Phone />
          </MotionButton>

          <MotionButton
            type="button"
            onClick={() => {
              hapticImpact();
              onAcceptVideo();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full text-white"
            style={{ background: callTheme.colors.primaryAction }}
            aria-label="Accept video call"
            {...buttonPressSpring}
          >
            <Video />
          </MotionButton>
        </MotionDiv>
      </MotionDiv>
    </div>
  );
}
