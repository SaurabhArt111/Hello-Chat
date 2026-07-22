import React, { useRef, useState, useEffect } from "react";
import { Clock } from "lucide-react";
import socket from "../../socket";
import axios from "../../api/axios";
import { useToastContext } from "../../context/ToastContext";

const TYPING_IDLE_MS = 1000;

const MessageInput = ({ onSend, onMediaMessage, activeChatId, isGroup = false, disabled = false, onSchedule }) => {
  const toast = useToastContext();
  const fileRef = useRef();
  const menuRef = useRef();
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState("");

  const openFilePicker = () => {
    if (fileRef.current) {
      fileRef.current.click();
    }
    setShowMenu(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const senderId = user?.id || user?._id;
    if (!senderId) return;

    let messageType = "file";
    if (file.type.startsWith("image/")) messageType = "image";
    else if (file.type.startsWith("video/")) messageType = "video";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("senderId", senderId);
    if (isGroup) {
      formData.append("groupId", activeChatId);
    } else {
      formData.append("receiverId", activeChatId);
    }
    formData.append("messageType", messageType);

    try {
      const res = await axios.post("/messages/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const saved = res.data;

      if (onMediaMessage) {
        onMediaMessage(saved);
      }
    } catch (err) {
      console.error("Failed to upload media", err);
      toast.error(err.response?.data?.message || "Failed to upload file");
    } finally {
      // Reset input so same file can be chosen again
      e.target.value = "";
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      stream.getTracks().forEach((t) => t.stop());

      canvas.toBlob(async (blob) => {
        if (!blob || !activeChatId) return;

        const user = JSON.parse(localStorage.getItem("user") || "null");
        const senderId = user?.id || user?._id;
        if (!senderId) return;

        const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("senderId", senderId);
        if (isGroup) {
          formData.append("groupId", activeChatId);
        } else {
          formData.append("receiverId", activeChatId);
        }
        formData.append("messageType", "image");

        try {
          const res = await axios.post("/messages/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const saved = res.data;
          if (onMediaMessage) {
            onMediaMessage(saved);
          }
        } catch (err) {
          console.error("Failed to upload camera image", err);
          toast.error(err.response?.data?.message || "Failed to upload image");
        }
      }, "image/jpeg");
    } catch (err) {
      console.error("Camera access error", err);
      toast.error("Camera access denied or failed");
    } finally {
      setShowMenu(false);
    }
  };

  const getVoiceMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    return "audio/webm";
  };

  const startVoiceRecording = async () => {
    if (!activeChatId || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getVoiceMimeType();
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) {
          setIsRecording(false);
          return;
        }
        const isMp4 = mimeType.startsWith("audio/mp4");
        const blobType = isMp4 ? "audio/mp4" : "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const senderId = user?.id || user?._id;
        if (!senderId) {
          setIsRecording(false);
          return;
        }
        const ext = isMp4 ? "m4a" : "webm";
        const file = new File([blob], `voice.${ext}`, { type: blobType });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("senderId", senderId);
        if (isGroup) {
          formData.append("groupId", activeChatId);
        } else {
          formData.append("receiverId", activeChatId);
        }
        formData.append("messageType", "voice");
        try {
          const res = await axios.post("/messages/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const saved = res.data;
          if (saved && !saved.messageType) saved.messageType = "voice";
          if (onMediaMessage) onMediaMessage(saved);
        } catch (err) {
          console.error("Voice upload failed", err);
          toast.error(err.response?.data?.message || "Failed to upload voice message");
        }
        chunksRef.current = [];
        setIsRecording(false);
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access error", err);
      toast.error("Microphone access denied or failed");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  useEffect(() => {
    const handleUp = () => {
      if (isRecording) stopVoiceRecording();
    };
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchend", handleUp, { passive: true });
    return () => {
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchend", handleUp);
    };
  }, [isRecording]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !e.target.closest("button")
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // SEND MESSAGE
  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && activeChatId) {
      socket.emit("stopTyping", {
        senderId: user.id,
        receiverId: activeChatId
      });
    }
  };

  // ENTER KEY SEND
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };


  return (
    <div className="relative bg-white dark:bg-neutral-800/95 backdrop-blur-sm p-2.5 md:p-4 rounded-2xl flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 shadow-lg border border-gray-200 dark:border-neutral-700 sticky bottom-0">

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.zip"
        onChange={handleFileChange}
      />

      {/* 📎 Attachment Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="text-gray-500 dark:text-neutral-400 hover:text-emerald-500 dark:hover:text-emerald-400 text-xl p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-xl transition-all duration-200 min-w-[40px] min-h-[40px]"
      >
        📎
      </button>

      {/* Attachment Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-16 left-2 bg-white dark:bg-neutral-800 backdrop-blur-md shadow-2xl rounded-2xl p-4 grid grid-cols-2 gap-3 w-52 border border-gray-200 dark:border-neutral-700"
        >
          <div onClick={openFilePicker} className="flex flex-col items-center cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform border border-gray-300 dark:border-neutral-600">🖼️</div>
            <span className="text-xs mt-2 text-gray-700 dark:text-neutral-300 font-medium">Image</span>
          </div>

          <div onClick={openFilePicker} className="flex flex-col items-center cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform border border-gray-300 dark:border-neutral-600">🎥</div>
            <span className="text-xs mt-2 text-gray-700 dark:text-neutral-300 font-medium">Video</span>
          </div>

          <div onClick={openFilePicker} className="flex flex-col items-center cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform border border-gray-300 dark:border-neutral-600">📄</div>
            <span className="text-xs mt-2 text-gray-700 dark:text-neutral-300 font-medium">Document</span>
          </div>

          <div onClick={handleCameraCapture} className="flex flex-col items-center cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform border border-gray-300 dark:border-neutral-600">📷</div>
            <span className="text-xs mt-2 text-gray-700 dark:text-neutral-300 font-medium">Camera</span>
          </div>
        </div>
      )}

      {/* 🎤 Voice Button - hold to record */}
      <button
        type="button"
        onMouseDown={startVoiceRecording}
        onTouchStart={(e) => { e.preventDefault(); startVoiceRecording(); }}
        className={`text-xl p-2 rounded-xl transition-all duration-200 select-none min-w-[40px] min-h-[40px] ${isRecording
          ? "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/20 animate-pulse"
          : "text-gray-500 dark:text-neutral-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-neutral-700"}`}
        title="Hold to record voice message"
      >
        🎤
      </button>

      {/* TEXT INPUT */}
      <input
        type="text"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);

          const user = JSON.parse(localStorage.getItem("user"));
          const userId = user?.id || user?._id;
          if (userId && activeChatId && !disabled) {
            socket.emit("typing", {
              senderId: userId,
              receiverId: activeChatId
            });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              socket.emit("stopTyping", {
                senderId: userId,
                receiverId: activeChatId
              });
              typingTimeoutRef.current = null;
            }, TYPING_IDLE_MS);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Sending..." : "Type a message..."}
        className="flex-1 min-w-0 w-full md:w-auto px-4 py-2.5 bg-gray-100 dark:bg-neutral-700/80 rounded-full outline-none border border-gray-300 dark:border-neutral-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-neutral-400 text-gray-900 dark:text-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* SCHEDULE BUTTON */}
      {onSchedule && text.trim() && (
        <button
          type="button"
          onClick={() => onSchedule(text)}
          className="p-2 rounded-xl text-gray-500 dark:text-neutral-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-all duration-200 min-w-[40px] min-h-[40px]"
          title="Schedule message"
        >
          <Clock size={20} />
        </button>
      )}

      {/* SEND BUTTON */}
      <button
        onClick={handleSend}
        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 md:px-6 py-2.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 min-w-[64px]"
        disabled={!text.trim() || disabled}
      >
        {disabled ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Sending...</span>
          </>
        ) : (
          <span>Send</span>
        )}
      </button>

      {/* Recording indicator - release to send */}
      {isRecording && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1.5 rounded-full text-xs animate-pulse whitespace-nowrap shadow-lg">
          Recording... Release to send
        </div>
      )}
    </div>
  );
};

export default MessageInput;
