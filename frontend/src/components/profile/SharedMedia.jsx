import React, { useEffect, useState } from "react";
import axios from "../../api/axios";
import socket from "../../socket";

const TABS = [
  { id: "media", label: "Media" },
  { id: "files", label: "Files" },
  { id: "links", label: "Links" },
];

const SharedMedia = ({ currentUserId, selectedUserId }) => {
  const [activeTab, setActiveTab] = useState("media");
  const [media, setMedia] = useState([]);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewItem, setPreviewItem] = useState(null);

  const canLoad = Boolean(
    currentUserId &&
      selectedUserId &&
      String(currentUserId) !== String(selectedUserId)
  );

  const fetchSharedMedia = async (pageToLoad = 1) => {
    if (!currentUserId || !selectedUserId || String(currentUserId) === String(selectedUserId))
      return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        `/shared-media/${String(currentUserId)}/${String(selectedUserId)}`,
        { params: { page: pageToLoad, limit: 50 } }
      );

      const { media: m = [], files: f = [], links: l = [], pagination } = res.data || {};

      if (pageToLoad === 1) {
        setMedia(m);
        setFiles(f);
        setLinks(l);
      } else {
        setMedia((prev) => [...prev, ...m]);
        setFiles((prev) => [...prev, ...f]);
        setLinks((prev) => [...prev, ...l]);
      }

      setHasMore(pagination?.hasMore || false);
      setPage(pageToLoad);
    } catch (err) {
      console.error("Failed to load shared media", err);
      setError("Failed to load shared media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reset when user pair changes
    setMedia([]);
    setFiles([]);
    setLinks([]);
    setPage(1);
    setHasMore(false);
    if (canLoad) {
      fetchSharedMedia(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, selectedUserId]);

  // Live updates via socket (media, files, links)
  useEffect(() => {
    const urlRegex = /https?:\/\/\S+/i;

    const handler = (msg) => {
      if (!currentUserId || !selectedUserId) return;

      const senderId = String(msg.senderId || msg.sender);
      const receiverId = String(msg.receiverId || msg.receiver);

      const a = String(currentUserId);
      const b = String(selectedUserId);

      const isBetween =
        (senderId === a && receiverId === b) ||
        (senderId === b && receiverId === a);
      if (!isBetween) return;

      const messageType = msg.messageType || msg.type || "text";
      const fileUrl = msg.fileUrl || msg.file || null;
      const text = msg.text || "";

      const base = {
        _id: msg._id,
        senderId,
        receiverId,
        messageType,
        fileUrl,
        fileName: msg.fileName || null,
        fileSize: msg.fileSize || null,
        text,
        createdAt: msg.createdAt || new Date().toISOString(),
      };

      if (["image", "video"].includes(messageType) && fileUrl) {
        setMedia((prev) => [base, ...prev]);
      } else if (messageType === "file" && fileUrl) {
        setFiles((prev) => [base, ...prev]);
      } else if (messageType === "link" || (messageType === "text" && urlRegex.test(text))) {
        setLinks((prev) => [base, ...prev]);
      }
    };

    socket.on("new_message", handler);
    return () => socket.off("new_message", handler);
  }, [currentUserId, selectedUserId]);

  const activeData =
    activeTab === "media" ? media : activeTab === "files" ? files : links;

  const showEmpty =
    !loading && (!activeData || activeData.length === 0);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-neutral-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-xl border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-emerald-500 text-emerald-500 dark:text-emerald-400"
                : "border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>
        )}

        {loading && activeData.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-6 w-6 text-emerald-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {showEmpty && (
          <p className="text-xs text-gray-500 dark:text-neutral-400 text-center py-6">
            No {activeTab} shared yet
          </p>
        )}

        {/* Media grid */}
        {activeTab === "media" && activeData.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {activeData.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setPreviewItem(item)}
                className="relative group overflow-hidden rounded-xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 aspect-square hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
              >
                {item.messageType === "video" ? (
                  <video
                    src={item.fileUrl}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={item.fileUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Files list */}
        {activeTab === "files" && activeData.length > 0 && (
          <div className="space-y-2">
            {activeData.map((item) => (
              <a
                key={item._id}
                href={item.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-700/80 border border-gray-200 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-500 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-neutral-100 truncate max-w-[160px]">
                      {item.fileName || "Document"}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400">
                      {item.fileSize || ""}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Links list */}
        {activeTab === "links" && activeData.length > 0 && (
          <div className="space-y-2">
            {activeData.map((item) => {
              const urlMatch =
                item.text && item.text.match(/https?:\/\/\S+/i);
              const url = urlMatch ? urlMatch[0] : item.fileUrl;
              return (
                <a
                  key={item._id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-700/80 border border-gray-200 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:border-gray-300 dark:hover:border-neutral-500 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔗</span>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate max-w-[200px]">
                      {url}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          type="button"
          onClick={() => fetchSharedMedia(page + 1)}
          disabled={loading}
          className="mt-3 text-xs w-full py-2.5 rounded-xl border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}

      {/* Preview modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="max-w-lg max-h-[80vh] bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            {previewItem.messageType === "video" ? (
              <video
                src={previewItem.fileUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={previewItem.fileUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedMedia;

