import React from "react";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Hash,
  UserPlus,
  PhoneOff,
  Bluetooth,
  PauseCircle,
  Notebook,
  Camera,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { buttonPressSpring } from "../animations/callAnimations";
import { callTheme } from "../constants/callTheme";

const MotionButton = motion.button;

function ControlButton({
  icon: Icon,
  label,
  active,
  danger,
  onClick,
  ariaLabel,
  minSize = 56,
}) {
  const baseStyle = danger
    ? { background: callTheme.colors.dangerAction }
    : active
      ? { background: "rgba(244,67,54,0.85)" }
      : callTheme.controlStyles;

  return (
    <MotionButton
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={label}
      className="flex flex-col items-center gap-1 text-white"
      style={{
        ...baseStyle,
        minWidth: minSize,
        minHeight: minSize,
        borderRadius: "999px",
        justifyContent: "center",
        border: danger ? "none" : callTheme.controlStyles.border,
      }}
      {...buttonPressSpring}
    >
      <Icon size={20} />
      <span className="text-[11px]">{label}</span>
    </MotionButton>
  );
}

export default function CallControls({
  mode,
  muted,
  speakerOn,
  videoOff,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onFlipCamera,
  onEffects,
  onEnd,
  onKeypad,
  onAddPerson,
  showSecondary,
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {showSecondary && mode === "voice" && (
        <div
          className="flex items-center gap-3 rounded-[32px] px-4 py-3"
          style={callTheme.controlStyles}
        >
          <ControlButton icon={Bluetooth} label="Bluetooth" onClick={() => {}} minSize={48} />
          <ControlButton icon={PauseCircle} label="Hold" onClick={() => {}} minSize={48} />
          <ControlButton icon={Notebook} label="Notes" onClick={() => {}} minSize={48} />
        </div>
      )}

      <div
        className="flex items-center gap-3 rounded-[32px] px-4 py-3 shadow-2xl"
        style={callTheme.controlStyles}
      >
        <ControlButton
          icon={muted ? MicOff : Mic}
          label={muted ? "Muted" : "Mute"}
          active={muted}
          onClick={onToggleMute}
        />
        {mode === "voice" ? (
          <>
            <ControlButton
              icon={speakerOn ? Volume2 : VolumeX}
              label="Speaker"
              active={speakerOn}
              onClick={onToggleSpeaker}
            />
            <ControlButton icon={Hash} label="Keypad" onClick={onKeypad} />
            <ControlButton icon={UserPlus} label="Add" onClick={onAddPerson} />
          </>
        ) : (
          <>
            <ControlButton icon={Repeat2} label="Flip" onClick={onFlipCamera} />
            <ControlButton
              icon={Camera}
              label={videoOff ? "Camera Off" : "Camera On"}
              active={videoOff}
              onClick={onToggleVideo}
            />
            <ControlButton icon={Sparkles} label="Effects" onClick={onEffects} />
          </>
        )}
        <ControlButton icon={PhoneOff} label="End" danger onClick={onEnd} />
      </div>
    </div>
  );
}
