import axios from "../api/axios";

let localIdCounter = 0;
/** Locally-unique id for an in-flight upload, used to reconcile the
 * optimistic "sending" bubble with the real message once the server
 * responds (or to mark it failed). Never sent to the server. */
export function generateLocalMediaId() {
  localIdCounter += 1;
  return `local-media-${Date.now()}-${localIdCounter}`;
}

/**
 * Build the optimistic message object shown in chat the instant a media
 * send starts - before the network request even begins. Uses a local
 * blob: URL for the preview so images/video/voice notes are visible and
 * (for voice) playable immediately, while `status: "sending"` drives the
 * spinner overlay in MessageBubble/VoiceMessageBubble.
 */
export function buildOptimisticMediaMessage({ localId, file, messageType, caption, duration, isOwn = true }) {
  const previewUrl = URL.createObjectURL(file);
  return {
    _id: undefined,
    localId,
    type: messageType,
    file: previewUrl,
    audioUrl: previewUrl,
    duration,
    text: caption || "",
    isOwn,
    status: "sending",
    uploadProgress: 0,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAt: new Date().toISOString(),
    // Kept so a failed upload can be retried without re-picking the file.
    _retry: { file, messageType, caption, duration },
  };
}

/**
 * Upload a media file (image/video/document/voice note) with progress
 * reporting. Resolves with the saved message from the server, or rejects
 * with the axios error (caller decides how to surface/retry it).
 */
export async function uploadMediaFile({
  file,
  senderId,
  activeChatId,
  isGroup,
  messageType,
  caption = "",
  duration,
  onProgress,
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("senderId", senderId);
  if (isGroup) {
    formData.append("groupId", activeChatId);
  } else {
    formData.append("receiverId", activeChatId);
  }
  formData.append("messageType", messageType);
  if (caption) formData.append("text", caption);
  if (duration != null) formData.append("duration", String(duration));

  const res = await axios.post("/messages/upload", formData, {
    onUploadProgress: (evt) => {
      if (!onProgress || !evt.total) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return res.data;
}
