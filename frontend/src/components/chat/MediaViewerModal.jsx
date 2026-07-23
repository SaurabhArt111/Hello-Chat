import React from "react";
import { FiX, FiDownload } from "react-icons/fi";

/**
 * Full-screen viewer opened when a user taps a sent/received image or video
 * bubble. Lets them see it full-size and download the original file.
 */
export default function MediaViewerModal({ url, type, fileName, onClose }) {
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
        <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Download">
          <FiDownload size={22} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {type === "image" ? (
          <img src={url} alt="media" className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg" />
        )}
      </div>
    </div>
  );
}
