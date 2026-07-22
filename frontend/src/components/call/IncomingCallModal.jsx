import React from "react";
import IncomingCallModal from "../../components/IncomingCallModal";
import { useCall } from "../../context/CallContext";

export default function IncomingCallOverlay() {
  const { incomingCaller, acceptCall, rejectCall, callState } = useCall();
  return (
    <IncomingCallModal
      isVisible={callState === "incoming" && !!incomingCaller}
      callerName={incomingCaller?.callerName || "Unknown"}
      relationTag="Direct message"
      onDecline={rejectCall}
      onAcceptAudio={acceptCall}
      onAcceptVideo={acceptCall}
      isForeground={!document.hidden}
    />
  );
}
