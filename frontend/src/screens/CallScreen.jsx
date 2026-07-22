import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneOff } from "lucide-react";
import toast from "react-hot-toast";
import { useCall } from "../context/CallContext";
import CallControls from "../components/CallControls";
import CallEndedSheet from "../components/CallEndedSheet";
import VideoCallScreen from "./VideoCallScreen";
import useCallState from "../hooks/useCallState";
import useCallTimer from "../hooks/useCallTimer";
import { callTheme, CALL_STATES } from "../constants/callTheme";
import { ripplePulse, screenSlideUp } from "../animations/callAnimations";

const MotionDiv = motion.div;

export default function CallScreen() {
  const {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    incomingCaller,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    endCall,
  } = useCall();
  const [speakerOn, setSpeakerOn] = useState(true);
  const [showSecondaryControls, setShowSecondaryControls] = useState(false);
  const [isAutoDimmed, setIsAutoDimmed] = useState(false);
  const [dots, setDots] = useState(".");
  const remoteAudioRef = useRef(null);
  const wakeLockRef = useRef(null);
  const previousStateRef = useRef(callState);

  const { mappedState, endedCallMeta, dismissEnded } = useCallState({
    rawState: callState,
    callType,
    incomingCaller,
    remoteUser,
    endCall,
  });

  const { formatted, seconds } = useCallTimer(mappedState === CALL_STATES.ACTIVE);

  useEffect(() => {
    if (mappedState !== CALL_STATES.CONNECTING) return undefined;
    const interval = window.setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : `${prev}.`));
    }, 500);
    return () => window.clearInterval(interval);
  }, [mappedState]);

  useEffect(() => {
    if (callState === "connected" && previousStateRef.current !== "connected") {
      toast.success("Call connected", { duration: 1500 });
    }
    previousStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (mappedState !== CALL_STATES.ACTIVE || callType !== "audio") return undefined;
    let timeout = window.setTimeout(() => setIsAutoDimmed(true), 5000);
    const onActivity = () => {
      setIsAutoDimmed(false);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setIsAutoDimmed(true), 5000);
    };
    window.addEventListener("pointermove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [mappedState, callType]);

  useEffect(() => {
    if (mappedState === CALL_STATES.ACTIVE) {
      navigator.wakeLock
        ?.request("screen")
        .then((lock) => {
          wakeLockRef.current = lock;
        })
        .catch(() => {});
    } else {
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    }
  }, [mappedState]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream && callType === "audio") {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType]);

  const isVideo = callType === "video";
  const name = remoteUser?.name || incomingCaller?.callerName || "Unknown";
  const remoteMuted = !!remoteStream && remoteStream.getAudioTracks().every((t) => !t.enabled);
  const bothMuted = isMuted && remoteMuted;

  if (isVideo && mappedState === CALL_STATES.ACTIVE) {
    return (
      <VideoCallScreen
        remoteUser={remoteUser}
        localStream={localStream}
        remoteStream={remoteStream}
        timer={formatted}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onEnd={endCall}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {(mappedState === CALL_STATES.CONNECTING || mappedState === CALL_STATES.ACTIVE) && (
          <MotionDiv
            className="fixed inset-0 z-[110] flex flex-col justify-between overflow-hidden text-white"
            style={{ background: callTheme.colors.background }}
            {...screenSlideUp}
          >
            {callType === "audio" && remoteStream && (
              <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            )}

            {/* Gradient + avatar backdrop */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#1B1E2F] via-[#0A0A0F] to-black opacity-95" />
            <div className="absolute inset-0 backdrop-blur-xl" />

            <div className="relative mt-20 flex flex-col items-center px-6 text-center">
              {mappedState === CALL_STATES.CONNECTING ? (
                <>
                  <div className="relative mb-6 h-32 w-32">
                    <MotionDiv
                      className="absolute inset-0 rounded-full border border-white/30"
                      {...ripplePulse}
                    />
                    <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white/20 text-4xl">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                  <h1 style={callTheme.typography.callerName}>{name}</h1>
                  <p style={callTheme.typography.status}>Calling{dots}</p>
                </>
              ) : (
                <>
                  <MotionDiv
                    className="mb-6 flex h-36 w-36 items-center justify-center rounded-full bg-white/20 text-5xl"
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </MotionDiv>
                  <h1 style={callTheme.typography.callerName}>{name}</h1>
                  <p style={callTheme.typography.timer}>{formatted}</p>
                  {bothMuted && <p className="mt-2 text-sm text-white/70">Both muted</p>}
                  {!remoteStream && (
                    <p className="mt-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                      Reconnecting...
                    </p>
                  )}
                </>
              )}
            </div>

            <MotionDiv
              className="relative mb-8 flex justify-center"
              animate={{ opacity: isAutoDimmed ? 0.2 : 1 }}
              onPanEnd={(_, info) => {
                if (info.offset.y < -40) setShowSecondaryControls((prev) => !prev);
              }}
            >
              <CallControls
                mode="voice"
                muted={isMuted}
                speakerOn={speakerOn}
                onToggleMute={toggleMute}
                onToggleSpeaker={() => setSpeakerOn((prev) => !prev)}
                onEnd={endCall}
                onKeypad={() => {}}
                onAddPerson={() => {}}
                showSecondary={showSecondaryControls}
              />
            </MotionDiv>

            {mappedState === CALL_STATES.CONNECTING && (
              <div className="relative mb-8 flex justify-center">
                <button
                  type="button"
                  onClick={endCall}
                  className="flex min-h-14 min-w-14 items-center justify-center rounded-full bg-red-500"
                  aria-label="End call"
                >
                  <PhoneOff />
                </button>
              </div>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>

      <CallEndedSheet
        open={Boolean(endedCallMeta)}
        durationSec={endedCallMeta?.durationSec || seconds}
        onCallAgain={dismissEnded}
        onSendMessage={dismissEnded}
        onBackToChat={dismissEnded}
      />
    </>
  );
}
