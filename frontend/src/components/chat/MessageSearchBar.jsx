import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { searchMessages } from "../../api/messages";

const DEBOUNCE_MS = 300;

const getMessageText = (msg) =>
  (msg.text ?? msg.translatedText ?? msg.originalText ?? "").toString().toLowerCase();

const searchInMessages = (messages, q) => {
  if (!Array.isArray(messages) || !q.trim()) return [];
  const lower = q.trim().toLowerCase();
  return messages.filter((msg) => {
    const text = getMessageText(msg);
    return text.length > 0 && text.includes(lower);
  });
};

const MessageSearchBar = ({ chatId, messages = [], onSelectMessage, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const res = await searchMessages(chatId, query.trim());
        const list = res?.data?.data ?? res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          setResults(list);
          setOpen(true);
          return;
        }
        throw new Error("No API results");
      } catch (err) {
        const clientResults = searchInMessages(messages, query.trim());
        setResults(clientResults);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, chatId, messages]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (msg) => {
    onSelectMessage?.(msg, query.trim());
    setOpen(false);
    setQuery("");
    setResults([]);
    onClose?.();
  };

  const preview = (msg) => {
    const text = msg.text ?? msg.translatedText ?? msg.originalText ?? "";
    if (!text) return "Media";
    return text.length > 60 ? text.slice(0, 60) + "…" : text;
  };

  const timeStr = (msg) => {
    const d = msg.createdAt ?? msg.time;
    if (!d) return "";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-xs">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-700/80 rounded-full px-3 py-2 border border-gray-300 dark:border-neutral-600 focus-within:ring-2 focus-within:ring-emerald-500">
        <Search size={18} className="text-gray-500 dark:text-neutral-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in chat"
          className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); onClose?.(); }}
            className="p-0.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-500 dark:text-neutral-400 transition-colors"
            aria-label="Clear"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && (query.trim() || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-700 z-50 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-neutral-400">
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-neutral-400">
              {query.trim() ? "No messages found" : "Type to search"}
            </div>
          ) : (
            results.map((msg) => (
              <button
                key={msg._id}
                type="button"
                onClick={() => handleSelect(msg)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors border-b border-gray-100 dark:border-neutral-700 last:border-0 rounded-t first:rounded-t-xl last:rounded-b-xl"
              >
                <p className="text-sm text-gray-900 dark:text-neutral-100 truncate">
                  {preview(msg)}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-0.5">
                  {timeStr(msg)}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MessageSearchBar;
