import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FiX,
  FiRotateCw,
  FiEdit3,
  FiType,
  FiSmile,
  FiDownload,
  FiSend,
  FiSliders,
  FiTrash2,
} from "react-icons/fi";

const FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "bw", label: "B&W", css: "grayscale(1)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.7)" },
  { id: "bright", label: "Bright", css: "brightness(1.25) saturate(1.1)" },
  { id: "cool", label: "Cool", css: "hue-rotate(180deg) saturate(1.2)" },
  { id: "contrast", label: "Contrast", css: "contrast(1.35)" },
];

const DRAW_COLORS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ffffff", "#111111"];
const STICKERS = ["😀", "😂", "😍", "🔥", "👍", "❤️", "🎉", "😮", "😢", "👏"];

/**
 * Pre-send editor for images and video. Images are fully editable (rotate,
 * draw, text, stickers, filters) via canvas compositing. Video can't be
 * re-encoded client-side (see compressFile.js for why), so for video we only
 * offer preview + caption + download + send.
 */
export default function MediaEditorModal({ file, onCancel, onConfirm }) {
  const isVideo = file?.type?.startsWith("video/");
  const isImage = file?.type?.startsWith("image/");

  const [objectUrl, setObjectUrl] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState("none");
  const [tool, setTool] = useState(null); // null | 'draw' | 'text' | 'stickers'
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [caption, setCaption] = useState("");
  const [overlays, setOverlays] = useState([]); // {type:'text'|'sticker', x,y,content,color}
  const [strokes, setStrokes] = useState([]); // array of {color, points:[{x,y}]}
  const [activeStroke, setActiveStroke] = useState(null);
  const [pendingTextPos, setPendingTextPos] = useState(null);
  const [textDraft, setTextDraft] = useState("");

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !isImage) return;
    const ctx = canvas.getContext("2d");

    const swap = rotation % 180 !== 0;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;

    ctx.save();
    ctx.filter = FILTERS.find((f) => f.id === filter)?.css || "none";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    ctx.filter = "none";
    // Freehand strokes
    strokes.concat(activeStroke ? [activeStroke] : []).forEach((s) => {
      if (!s.points.length) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(3, canvas.width * 0.006);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.xr * canvas.width;
        const y = p.yr * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Text + stickers
    overlays.forEach((o) => {
      const x = o.xr * canvas.width;
      const y = o.yr * canvas.height;
      if (o.type === "sticker") {
        ctx.font = `${Math.round(canvas.width * 0.08)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.content, x, y);
      } else {
        ctx.font = `${Math.round(canvas.width * 0.045)}px sans-serif`;
        ctx.fillStyle = o.color || "#ffffff";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = Math.max(2, canvas.width * 0.004);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(o.content, x, y);
        ctx.fillText(o.content, x, y);
      }
    });
  }, [rotation, filter, strokes, activeStroke, overlays, isImage]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleImgLoad = () => redraw();

  const relPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      xr: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      yr: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e) => {
    if (tool === "draw") {
      const p = relPos(e);
      setActiveStroke({ color: drawColor, points: [p] });
    } else if (tool === "text") {
      setPendingTextPos(relPos(e));
      setTextDraft("");
    } else if (tool === "stickers") {
      // handled by sticker picker buttons
    }
  };

  const handlePointerMove = (e) => {
    if (tool === "draw" && activeStroke) {
      const p = relPos(e);
      setActiveStroke((s) => ({ ...s, points: [...s.points, p] }));
    }
  };

  const handlePointerUp = () => {
    if (tool === "draw" && activeStroke) {
      setStrokes((s) => [...s, activeStroke]);
      setActiveStroke(null);
    }
  };

  const placeSticker = (emoji) => {
    setOverlays((o) => [
      ...o,
      { type: "sticker", content: emoji, xr: 0.5, yr: 0.4 + o.length * 0.06 },
    ]);
  };

  const confirmText = () => {
    if (textDraft.trim() && pendingTextPos) {
      setOverlays((o) => [
        ...o,
        { type: "text", content: textDraft.trim(), color: drawColor, ...pendingTextPos },
      ]);
    }
    setPendingTextPos(null);
    setTextDraft("");
  };

  const clearEdits = () => {
    setStrokes([]);
    setOverlays([]);
    setRotation(0);
    setFilter("none");
  };

  const getEditedBlob = () =>
    new Promise((resolve) => {
      if (!isImage || !canvasRef.current) return resolve(file);
      canvasRef.current.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    });

  const handleDownload = async () => {
    const blob = isImage ? await getEditedBlob() : file;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = blob.name || file.name || "media";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    const finalFile = isImage ? await getEditedBlob() : file;
    onConfirm(finalFile, caption.trim());
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Cancel">
          <FiX size={22} />
        </button>
        {isImage && (
          <div className="flex items-center gap-1">
            <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Rotate">
              <FiRotateCw size={20} />
            </button>
            <button onClick={() => setTool(tool === "draw" ? null : "draw")} className={`p-2 rounded-full transition-colors ${tool === "draw" ? "bg-emerald-500" : "hover:bg-white/10"}`} title="Draw">
              <FiEdit3 size={20} />
            </button>
            <button onClick={() => setTool(tool === "text" ? null : "text")} className={`p-2 rounded-full transition-colors ${tool === "text" ? "bg-emerald-500" : "hover:bg-white/10"}`} title="Add text">
              <FiType size={20} />
            </button>
            <button onClick={() => setTool(tool === "stickers" ? null : "stickers")} className={`p-2 rounded-full transition-colors ${tool === "stickers" ? "bg-emerald-500" : "hover:bg-white/10"}`} title="Stickers">
              <FiSmile size={20} />
            </button>
            <button onClick={() => setTool(tool === "filters" ? null : "filters")} className={`p-2 rounded-full transition-colors ${tool === "filters" ? "bg-emerald-500" : "hover:bg-white/10"}`} title="Filters">
              <FiSliders size={20} />
            </button>
            {(strokes.length > 0 || overlays.length > 0 || rotation !== 0 || filter !== "none") && (
              <button onClick={clearEdits} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Clear edits">
                <FiTrash2 size={20} />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Download">
            <FiDownload size={20} />
          </button>
        </div>
      </div>

      {/* Canvas / preview area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden relative px-4">
        {isImage && (
          <>
            {/* Hidden source image used to (re)draw the canvas */}
            <img ref={imgRef} src={objectUrl} onLoad={handleImgLoad} className="hidden" alt="" />
            <canvas
              ref={canvasRef}
              className="max-h-full max-w-full rounded-lg shadow-2xl touch-none"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </>
        )}
        {isVideo && objectUrl && (
          <video src={objectUrl} controls className="max-h-full max-w-full rounded-lg shadow-2xl" />
        )}
        {!isImage && !isVideo && (
          <div className="text-white text-center">
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-white/60 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        )}

        {/* Sticker picker */}
        {tool === "stickers" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur rounded-2xl p-3 flex gap-2 flex-wrap max-w-[90%] justify-center shadow-xl">
            {STICKERS.map((s) => (
              <button key={s} onClick={() => placeSticker(s)} className="text-2xl hover:scale-125 transition-transform">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Color picker for draw/text */}
        {(tool === "draw" || tool === "text") && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur rounded-2xl p-2.5 flex gap-2 shadow-xl">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDrawColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${drawColor === c ? "scale-110 border-white" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {/* Filter strip */}
        {tool === "filters" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur rounded-2xl p-2.5 flex gap-2 shadow-xl overflow-x-auto max-w-[92%]">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  filter === f.id ? "bg-emerald-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Inline text entry */}
        {pendingTextPos && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pendingTextPos.xr * 100}%`, top: `${pendingTextPos.yr * 100}%` }}
          >
            <input
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmText()}
              onBlur={confirmText}
              placeholder="Type..."
              className="bg-transparent border-b-2 border-white text-white text-lg text-center outline-none placeholder:text-white/50"
              style={{ color: drawColor }}
            />
          </div>
        )}
      </div>

      {/* Bottom bar: caption + send */}
      <div className="flex items-center gap-2 p-3 bg-neutral-900/95">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption..."
          className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-neutral-800 text-white placeholder:text-neutral-400 outline-none border border-neutral-700 focus:border-emerald-500 transition-colors"
        />
        <button
          onClick={handleConfirm}
          className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full transition-colors shadow-lg active:scale-95"
          title="Send"
        >
          <FiSend size={20} />
        </button>
      </div>
    </div>
  );
}
