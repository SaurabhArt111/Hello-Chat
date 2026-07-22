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
];

export function CallProvider({ children }) {
  const [callState, setCallState] = useState("idle"); // idle | calling | incoming | connected
  const [callType, setCallType] = useState("audio");
  const [remoteUser, setRemoteUser] = useState(null); // { id, name }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState(null); // { callerId, callerName, callType }

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const currentCallIdRef = useRef(null);
  const callConnectedAtRef = useRef(null);

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
  }, []);

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

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          cleanup();
        }
      };

      peerConnectionRef.current = pc;

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
    [getUserId, cleanup]
  );

  const startCall = useCallback(
    async (type, receiverId, receiverName) => {
      const userId = getUserId();
      if (!userId || !receiverId) return;

      setCallType(type || "audio");
      setRemoteUser({ id: receiverId, name: receiverName || "User" });
      setCallState("calling");

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
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
    setCallState("connected");
    callConnectedAtRef.current = Date.now();
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
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      console.error("getUserMedia error:", err);
      cleanup();
      return;
    }

    socket.emit("accept_call", {
      callerId: caller.callerId,
      receiverId: userId,
      callId: caller.callId,
    });

    createPeerConnection(false);
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
    const userId = getUserId();
    const otherId = remoteUser?.id || incomingCaller?.callerId;
    if (otherId) {
      socket.emit("end_call", {
        to: otherId,
        from: userId,
        callId: currentCallIdRef.current,
      });
    }
    const connectedAt = callConnectedAtRef.current;
    const durationSec =
      connectedAt != null
        ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
        : 0;
    logCallEnd("answered", durationSec);
    cleanup();
  }, [getUserId, remoteUser, incomingCaller, cleanup, logCallEnd]);

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
      callConnectedAtRef.current = Date.now();
      setCallState("connected");
      const pc = createPeerConnection(true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", {
        to: data.receiverId,
        from: userId,
        offer,
      });
    };

    const handleCallRejected = () => {
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
        cleanup();
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
        cleanup();
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
      logCallEnd("missed", 0);
      cleanup();
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_rejected", handleCallRejected);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_timeout", handleCallTimeout);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_rejected", handleCallRejected);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_ended", handleCallEnded);
      socket.off("call_timeout", handleCallTimeout);
    };
  }, [getUserId, cleanup, createPeerConnection, flushIceQueue, logCallEnd]);

  const value = {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    incomingCaller,
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
