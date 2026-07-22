import React from "react";
import { motion } from "framer-motion";

const MotionDiv = motion.div;

export default function PipView({
  videoRef,
  onDoubleTap,
  expanded,
  onPointerDown,
  onPointerUp,
  parentRef,
}) {
  const size = expanded ? { width: 180, height: 240 } : { width: 128, height: 170 };

  return (
    <MotionDiv
      drag
      dragMomentum={false}
      dragElastic={0.12}
      dragConstraints={parentRef}
      whileDrag={{ scale: 1.03 }}
      dragTransition={{ power: 0, timeConstant: 120, modifyTarget: () => 0 }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleTap}
      className="absolute z-30 overflow-hidden rounded-2xl border border-white/30 bg-black shadow-2xl"
      style={{
        ...size,
        top: 16,
        right: 16,
        touchAction: "none",
      }}
      animate={{}}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      title="Double tap to swap video feeds"
    >
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent" />
    </MotionDiv>
  );
}
