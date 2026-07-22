import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SmilePlus } from "lucide-react";
import CallControls from "../components/CallControls";
import PipView from "../components/PipView";
import { callTheme } from "../constants/callTheme";
import { controlBarHide } from "../animations/callAnimations";

const REACTIONS = ["😂", "❤️", "👍"];
const MotionDiv = motion.div;
const MotionVideo = motion.video;

export default function VideoCallScreen({
  remoteUser,
  localStream,
  remoteStream,
  timer,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEnd,
}) {
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const containerRef = useRef(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pipExpanded, setPipExpanded] = useState(false);
  const [networkQuality, setNetworkQuality] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [showReactions, setShowReactions] = useState(false);
  const [flipState, setFlipState] = useState(0);
  const [usingSwappedFeeds, setUsingSwappedFeeds] = useState(false);

  useEffect(() => {
    const remoteTarget = usingSwappedFeeds ? localStream : remoteStream;
    const localTarget = usingSwappedFeeds ? remoteStream : localStream;
    if (remoteVideoRef.current && remoteTarget) remoteVideoRef.current.srcObject = remoteTarget;
    if (localVideoRef.current && localTarget) localVideoRef.current.srcObject = localTarget;
  }, [localStream, remoteStream, usingSwappedFeeds]);

  useEffect(() => {
    let timeout = window.setTimeout(() => setControlsVisible(false), 3000);
    const refresh = () => {
      setControlsVisible(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setControlsVisible(false), 3000);
    };
    window.addEventListener("pointermove", refresh);
    window.addEventListener("touchstart", refresh, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointermove", refresh);
      window.removeEventListener("touchstart", refresh);
    };
  }, []);

  useEffect(() => {
    const network = navigator.connection;
    const updateQuality = () => {
      const type = network?.effectiveType || "4g";
      if (type.includes("2g")) setNetworkQuality(1);
      else if (type.includes("3g")) setNetworkQuality(2);
      else if (type.includes("4g")) setNetworkQuality(4);
      else setNetworkQuality(3);
    };
    updateQuality();
    network?.addEventListener?.("change", updateQuality);
    return () => network?.removeEventListener?.("change", updateQuality);
  }, []);

  useEffect(() => {
    const applyBatteryOptimization = async () => {
      if (!navigator.getBattery || !localStream) return;
      const battery = await navigator.getBattery();
      if (battery.level < 0.2) {
        const [videoTrack] = localStream.getVideoTracks();
        videoTrack?.applyConstraints({ frameRate: { max: 30 } }).catch(() => {});
      }
    };
    applyBatteryOptimization();
  }, [localStream]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const signalBars = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, index) => (
        <span
          key={index}
          className="h-2 w-1 rounded-full"
          style={{
            opacity: index < networkQuality ? 1 : 0.25,
            background: "#fff",
            transform: `scaleY(${0.5 + index * 0.25})`,
          }}
        />
      )),
    [networkQuality]
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[115] bg-black text-white"
      onClick={() => setControlsVisible((prev) => !prev)}
    >
      <MotionVideo
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
        style={{ scale: zoom }}
        animate={{ rotateY: flipState }}
        onWheel={(event) => {
          event.preventDefault();
          const direction = event.deltaY > 0 ? -0.1 : 0.1;
          setZoom((prev) => Math.min(2, Math.max(1, prev + direction)));
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") return;
          const timeout = window.setTimeout(() => setShowReactions(true), 500);
          const clear = () => {
            window.clearTimeout(timeout);
            window.removeEventListener("pointerup", clear);
          };
          window.addEventListener("pointerup", clear);
        }}
      />

      <PipView
        videoRef={localVideoRef}
        expanded={pipExpanded}
        parentRef={containerRef}
        onPointerDown={() => setControlsVisible(true)}
        onPointerUp={() => setControlsVisible(true)}
        onDoubleTap={() => setUsingSwappedFeeds((prev) => !prev)}
      />

      {showReactions && (
        <div className="absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 gap-2 rounded-full bg-black/45 p-2">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="text-2xl"
              onClick={() => setShowReactions(false)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <MotionDiv
        variants={controlBarHide}
        animate={controlsVisible ? "visible" : "hidden"}
        className="absolute left-0 top-0 z-20 flex w-full items-center justify-between p-4"
      >
        <div className="rounded-2xl bg-black/35 px-3 py-2">
          <p className="text-sm font-medium">{remoteUser?.name || "User"}</p>
          <p style={callTheme.typography.timer}>{timer}</p>
        </div>
        <div className="flex items-end gap-1 rounded-xl bg-black/35 px-2 py-1">{signalBars}</div>
      </MotionDiv>

      <MotionDiv
        variants={controlBarHide}
        animate={controlsVisible ? "visible" : "hidden"}
        className="absolute bottom-6 left-0 z-20 flex w-full justify-center"
      >
        <CallControls
          mode="video"
          muted={isMuted}
          videoOff={isVideoOff}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onFlipCamera={() => {
            setFlipState((prev) => prev + 180);
            setPipExpanded((prev) => !prev);
          }}
          onEffects={() => setShowReactions(true)}
          onEnd={onEnd}
        />
      </MotionDiv>

      {!remoteStream && (
        <div className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
          Reconnecting...
        </div>
      )}

      <button
        type="button"
        className="absolute right-4 top-20 z-30 rounded-full bg-black/30 p-2"
        onClick={() => setShowReactions((prev) => !prev)}
        aria-label="Open reactions"
      >
        <SmilePlus size={18} />
      </button>
    </div>
  );
}
