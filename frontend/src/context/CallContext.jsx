import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import socket from "../socket";
import * as callApi from "../api/calls";

const CallContext = createContext(null);

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN is what actually fixes "calls break constantly" / connect-then-
  // immediately-die symptoms: STUN alone only works when both callers are
  // on "easy" networks (open NAT). The moment either side is on mobile
  // data, a corporate network, or a symmetric NAT, a P2P path often
  // cannot be found at all and the call fails - this was very likely the
  // root cause of the "Call Ended - 00:00" bug, since ICE would fail
  // almost immediately with no relay to fall back to.
  //
  // Falls back to OpenRelay's free public TURN server (openrelay.metered.ca)
  // so calls work out of the box with zero setup. It's a shared, rate-
  // limited community relay - fine to ship with, but for production
  // reliability at real scale, set VITE_TURN_URL / VITE_TURN_USERNAME /
  // VITE_TURN_CREDENTIAL in frontend/.env to your own TURN server (Twilio
  // NTS, Metered.ca paid plan, Xirsys, or self-hosted coturn).
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : [
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
      ]),
];

// How long we'll wait for the connection to actually reach "connected"
// before giving up and treating it as a real failure instead of leaving
// the UI stuck on a silent, dead "Active call" screen.
const CONNECT_TIMEOUT_MS = 20000;

const getUserMedia = async (constraints) => {
  if (typeof navigator === "undefined") {
    throw new Error("navigator is not available");
  }

  if (navigator.mediaDevices?.getUserMedia) {
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyGetUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

  if (!legacyGetUserMedia) {
    throw new Error("getUserMedia is not supported in this browser");
  }

  return await new Promise((resolve, reject) => {
    legacyGetUserMedia.call(navigator, constraints, resolve, reject);
  });
};

export function CallProvider({ children }) {
  const [callState, setCallState] = useState("idle"); // idle | calling | incoming | connected
  const [callType, setCallType] = useState("audio");
  const [remoteUser, setRemoteUser] = useState(null); // { id, name }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState(null); // { callerId, callerName, callType }
  const [recipientOffline, setRecipientOffline] = useState(false);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const currentCallIdRef = useRef(null);
  const callConnectedAtRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const hasEverConnectedRef = useRef(false);
  const isCallerRef = useRef(false);

  const getUserId = useCallback(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.id || user?._id;
  }, []);

  const logCallEnd = useCallback(async (status = "missed", durationSec = 0) => {
    const callId = currentCallIdRef.current;
    if (callId) {
      currentCallIdRef.current = null;
      try {
        await callApi.endCall(callId, durationSec, status);
      } catch (err) {
        console.error("Call log end failed:", err);
      }
    }
    callConnectedAtRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    hasEverConnectedRef.current = false;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidateQueueRef.current = [];
    setCallState("idle");
    setRemoteUser(null);
    setIncomingCaller(null);
    setRecipientOffline(false);
  }, []);

  /**
   * Ends the call AND makes sure the other participant is told about it.
   * Previously, a locally-detected failure (ICE never connecting, an
   * offer/answer error, connectionState -> "closed") called cleanup()
   * directly without emitting "end_call" - the other side's screen would
   * just sit on a dead, silent "connected" call forever with no signal
   * that anything went wrong. Every local end-of-call path should go
   * through this instead of calling cleanup() directly.
   */
  const hangupAndNotify = useCallback(
    (status = "answered") => {
      const userId = getUserId();
      const otherId = remoteUserIdRef.current;
      if (otherId) {
        socket.emit("end_call", {
          to: otherId,
          from: userId,
          callId: currentCallIdRef.current,
        });
      }
      const connectedAt = callConnectedAtRef.current;
      const durationSec =
        connectedAt != null ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)) : 0;
      logCallEnd(status, durationSec);
      cleanup();
    },
    [getUserId, cleanup, logCallEnd]
  );

  const remoteUserIdRef = useRef(null);
  remoteUserIdRef.current = remoteUser?.id || incomingCaller?.callerId;

  const flushIceQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const queue = iceCandidateQueueRef.current;
    if (!pc || !pc.remoteDescription || queue.length === 0) return;
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("addIceCandidate error:", err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (isCaller) => {
      iceCandidateQueueRef.current = [];
      isCallerRef.current = isCaller;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      pc.ontrack = (e) => {
        if (e.streams?.[0]) {
          setRemoteStream(e.streams[0]);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const userId = getUserId();
          const toId = remoteUserIdRef.current;
          if (toId) {
            socket.emit("ice_candidate", {
              to: toId,
              from: userId,
              candidate: e.candidate,
            });
          }
        }
      };

      // Makes ICE restarts actually work: restartIce() alone only flags
      // that new candidates should be gathered - without listening for
      // negotiationneeded and sending a fresh offer, nothing ever tells
      // the other peer to renegotiate, so the call just stays broken.
      // Only the original caller drives renegotiation (matches the
      // existing initial offer/answer flow) to avoid both sides sending
      // competing offers at once.
      let negotiating = false;
      pc.onnegotiationneeded = async () => {
        if (!isCallerRef.current || negotiating) return;
        const toId = remoteUserIdRef.current;
        if (!toId) return;
        negotiating = true;
        try {
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") return;
          await pc.setLocalDescription(offer);
          socket.emit("offer", {
            to: toId,
            from: getUserId(),
            offer: pc.localDescription,
          });
        } catch (err) {
          console.error("Renegotiation (ICE restart) failed:", err);
        } finally {
          negotiating = false;
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          hasEverConnectedRef.current = true;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
        } else if (pc.connectionState === "failed") {
          // "failed" can often be recovered from with an ICE restart
          // (e.g. after a brief network blip or wifi/cellular handoff on
          // mobile) instead of dropping the whole call immediately - the
          // onnegotiationneeded handler above now actually completes this
          // restart instead of it silently doing nothing.
          if (hasEverConnectedRef.current) {
            pc.restartIce?.();
          } else {
            // Never connected at all (most likely no viable ICE
            // candidate pair even through TURN) - don't loop retrying
            // forever, end the call cleanly and tell the other side.
            hangupAndNotify("failed");
          }
        } else if (pc.connectionState === "closed") {
          // The connection is gone (locally closed, or the browser tore
          // it down) - make sure the other participant is actually told,
          // instead of being left on a silent, dead call screen forever.
          hangupAndNotify(hasEverConnectedRef.current ? "answered" : "failed");
        }
        // Note: "disconnected" is intentionally NOT treated as a hangup.
        // It's often transient (packet loss, brief network switch) and
        // usually self-recovers to "connected"; ending the call here was
        // causing calls to drop on ordinary network hiccups, especially
        // on mobile.
      };

      peerConnectionRef.current = pc;

      // Watchdog: if we never reach "connected" at all within
      // CONNECT_TIMEOUT_MS of setting up this peer connection, the ICE
      // negotiation is stuck (bad network, blocked UDP/TCP, etc) - fail
      // the call explicitly instead of leaving the UI on a silent,
      // frozen "Active call" screen indefinitely.
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        if (!hasEverConnectedRef.current && peerConnectionRef.current === pc) {
          hangupAndNotify("failed");
        }
      }, CONNECT_TIMEOUT_MS);

      // Apply basic outbound bitrate cap for stability (if supported)
      try {
        pc.getSenders().forEach((sender) => {
          const params = sender.getParameters();
          if (!params.encodings || !params.encodings.length) {
            params.encodings = [{}];
          }
          // ~1 Mbps cap; enough for 720p but avoids runaway bandwidth.
          params.encodings[0].maxBitrate = 1_000_000;
          sender.setParameters(params).catch(() => {});
        });
      } catch (err) {
        console.error("Failed to set maxBitrate on RTCRtpSender:", err);
      }
      return pc;
    },
    [getUserId, hangupAndNotify]

  );

  const startCall = useCallback(
    async (type, receiverId, receiverName) => {
      const userId = getUserId();
      if (!userId || !receiverId) return;

      setCallType(type || "audio");
      setRemoteUser({ id: receiverId, name: receiverName || "User" });
      setCallState("calling");
      setRecipientOffline(false);

      try {
        const res = await callApi.startCall(receiverId, type || "audio");
        if (res?.data?.data?._id) {
          currentCallIdRef.current = res.data.data._id;
        }
      } catch (err) {
        console.error("Call log start failed:", err);
      }

      try {
        const constraints =
          type === "video"
            ? {
                audio: true,
                video: {
                  width: { max: 1280 },
                  height: { max: 720 },
                  frameRate: { max: 30 },
                },
              }
            : { audio: true, video: false };
        const stream = await getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error("getUserMedia error:", err);
        setCallState("idle");
        setRemoteUser(null);
        currentCallIdRef.current = null;
        return;
      }

      socket.emit("call_user", {
        callerId: userId,
        receiverId,
        callType: type || "audio",
        callerName: JSON.parse(localStorage.getItem("user") || "{}")?.username || "Caller",
        callId: currentCallIdRef.current,
      });
    },
    [getUserId]
  );

  const acceptCall = useCallback(async () => {
    const userId = getUserId();
    const caller = incomingCaller;
    if (!caller || !userId) return;

    setCallType(caller.callType || "audio");
    setRemoteUser({ id: caller.callerId, name: caller.callerName || "User" });
    if (caller.callId) {
      currentCallIdRef.current = caller.callId;
    }
    setIncomingCaller(null);

    try {
      const constraints =
        caller.callType === "video"
          ? {
              audio: true,
              video: {
                width: { max: 1280 },
                height: { max: 720 },
                frameRate: { max: 30 },
              },
            }
          : { audio: true, video: false };
      const stream = await getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      console.error("getUserMedia error:", err);
      // We haven't told the caller we're accepting yet - let them know we
      // can't take the call instead of leaving them ringing indefinitely.
      socket.emit("reject_call", {
        callerId: caller.callerId,
        receiverId: userId,
        callId: caller.callId,
      });
      cleanup();
      return;
    }

    createPeerConnection(false);
    setCallState("connected");
    callConnectedAtRef.current = Date.now();

    socket.emit("accept_call", {
      callerId: caller.callerId,
      receiverId: userId,
      callId: caller.callId,
    });
  }, [getUserId, incomingCaller, createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    const userId = getUserId();
    const caller = incomingCaller;
    if (caller) {
      socket.emit("reject_call", {
        callerId: caller.callerId,
        receiverId: userId,
        callId: caller.callId,
      });
    }
    setIncomingCaller(null);
    setCallState("idle");
  }, [getUserId, incomingCaller]);

  const endCall = useCallback(() => {
    hangupAndNotify("answered");
  }, [hangupAndNotify]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    } else {
      setIsMuted((m) => !m);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    } else {
      setIsVideoOff((v) => !v);
    }
  }, []);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const handleIncomingCall = (data) => {
      setIncomingCaller({
        callerId: data.callerId,
        callerName: data.callerName || "Someone",
        callType: data.callType || "audio",
        callId: data.callId,
      });
      setCallState("incoming");
    };

    const handleCallAccepted = async (data) => {
      setRecipientOffline(false);
      callConnectedAtRef.current = Date.now();
      setCallState("connected");
      try {
        const pc = createPeerConnection(true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          to: data.receiverId,
          from: userId,
          offer,
        });
      } catch (err) {
        console.error("Failed to create initial offer:", err);
        hangupAndNotify("failed");
      }
    };

    const handleCallRingingOffline = () => {
      setRecipientOffline(true);
    };

    const handleCallRejected = () => {
      setRecipientOffline(false);
      logCallEnd("rejected", 0);
      setCallState("idle");
      setRemoteUser(null);
      cleanup();
    };

    const handleOffer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc || !data.offer) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushIceQueue();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", {
          to: data.from,
          from: userId,
          answer,
        });
      } catch (err) {
        console.error("handleOffer error:", err);
        hangupAndNotify("failed");
      }
    };

    const handleAnswer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc || !data.answer) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushIceQueue();
      } catch (err) {
        console.error("handleAnswer error:", err);
        hangupAndNotify("failed");
      }
    };

    const handleIceCandidate = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc || !data.candidate) return;
      const candidate = new RTCIceCandidate(data.candidate);
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error("addIceCandidate error:", err);
          iceCandidateQueueRef.current.push(data.candidate);
        }
      } else {
        iceCandidateQueueRef.current.push(data.candidate);
      }
    };

    const handleCallEnded = () => {
      setRecipientOffline(false);
      const connectedAt = callConnectedAtRef.current;
      const durationSec =
        connectedAt != null
          ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
          : 0;
      logCallEnd("answered", durationSec);
      cleanup();
    };

    const handleCallTimeout = () => {
      // Treat as missed call for the caller; no-op for receiver without callId.
      setRecipientOffline(false);
      logCallEnd("missed", 0);
      cleanup();
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_ringing_offline", handleCallRingingOffline);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_timeout", handleCallTimeout);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_ringing_offline", handleCallRingingOffline);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_ended", handleCallEnded);
      socket.off("call_timeout", handleCallTimeout);
    };
  }, [getUserId, cleanup, createPeerConnection, flushIceQueue, logCallEnd, hangupAndNotify]);

  const value = {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    incomingCaller,
    recipientOffline,
    isMuted,
    isVideoOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };

  return (
    <CallContext.Provider value={value}>{children}</CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
