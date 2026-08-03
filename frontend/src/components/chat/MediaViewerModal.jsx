import React, { useState, useEffect } from "react";
import { FiX, FiDownload, FiFile } from "react-icons/fi";

/**
 * Full-screen viewer opened when a user taps a sent/received image or video
 * bubble. Lets them see it full-size and download the original file.
 */
export default function MediaViewerModal({ url, type, fileName, onClose }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url) return null;

  const handleDownload = async () => {
    try {
      // Fetch as a blob so the browser saves the file instead of navigating
      // to it (which is what a plain <a href> does for media the browser
      // knows how to render, like images/video).
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || url.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // CORS or network hiccup - fall back to opening it directly.
      window.open(url, "_blank", "noopener");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <FiX size={22} />
        </button>
        {!failed && (
          <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Download">
            <FiDownload size={22} />
          </button>
        )}
      </div>
      <div
        className="flex-1 flex items-center justify-center px-4 pb-4 min-h-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {failed ? (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <FiFile size={40} />
            <p className="text-sm">This media is no longer available.</p>
          </div>
        ) : type === "image" ? (
          <img
            src={url}
            alt="media"
            onError={() => setFailed(true)}
            className="w-auto h-auto max-w-full max-h-[calc(100vh-100px)] object-contain rounded-lg"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            onError={() => setFailed(true)}
            className="w-auto h-auto max-w-full max-h-[calc(100vh-100px)] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  );
}
