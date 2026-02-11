"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface ImageCropModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Close the modal without saving */
  onClose: () => void;
  /** Called with the final uploaded image URL */
  onComplete: (url: string) => void;
  /** Aspect ratio: 1 for avatar (square), ~3 for banner (wide) */
  aspect: number;
  /** Label shown at the top */
  title: string;
  /** Shape of the crop area */
  cropShape?: "rect" | "round";
  /** If true, skip cropping and upload immediately after selection */
  skipCrop?: boolean;
}

// Canvas helper — crops the image and returns a Blob
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/jpeg", 0.92);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export default function ImageCropModal({
  open,
  onClose,
  onComplete,
  aspect,
  title,
  cropShape = "rect",
  skipCrop = false,
}: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"upload" | "url" | "paste">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setUploading(false);
      setTab("upload");
      setUrlInput("");
      setUrlError("");
    }
  }, [open]);

  // Listen for paste events when modal is open
  useEffect(() => {
    if (!open) return;

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => setImageSrc(reader.result as string);
            reader.readAsDataURL(file);
          }
          return;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleLoadUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlError("");
    // Test if the URL loads as an image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageSrc(url);
    img.onerror = () => setUrlError("Could not load image from this URL");
    img.src = url;
  }

  // Stable ref for onComplete to avoid re-triggering the skipCrop effect
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // When skipCrop is true, upload immediately once an image is selected
  useEffect(() => {
    if (!skipCrop || !imageSrc || uploading) return;
    (async () => {
      setUploading(true);
      try {
        // Convert the image source to a blob for upload
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append("file", blob, "image.jpg");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { url } = await res.json();
          onCompleteRef.current(url);
        }
      } catch {
        // If fetch fails (e.g. data URL from paste), convert via canvas
        try {
          const image = await createImage(imageSrc);
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(image, 0, 0);
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92);
          });
          const formData = new FormData();
          formData.append("file", blob, "image.jpg");
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (res.ok) {
            const { url } = await res.json();
            onCompleteRef.current(url);
          }
        } catch {
          console.error("Upload failed");
        }
      } finally {
        setUploading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipCrop, imageSrc]);

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("file", blob, "cropped.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        onComplete(url);
      }
    } catch {
      console.error("Crop/upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] bg-[#12121a] shadow-2xl shadow-purple-500/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white/90">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {imageSrc && skipCrop ? (
          /* ── Uploading state for skipCrop ── */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            <p className="text-sm text-white/40">Uploading image...</p>
          </div>
        ) : !imageSrc ? (
          /* ── Source selection ── */
          <div className="p-5">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              {([
                { key: "upload" as const, label: "Upload File" },
                { key: "url" as const, label: "Paste URL" },
                { key: "paste" as const, label: "Paste Image" },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    tab === t.key
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                      : "text-white/30 hover:text-white/50 border border-transparent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Upload tab */}
            {tab === "upload" && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/30 bg-white/[0.01] hover:bg-purple-500/[0.02] transition-all cursor-pointer"
              >
                <svg className="w-10 h-10 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-white/30">Click to choose a file</p>
                <p className="text-[11px] text-white/15">JPG, PNG, WebP &middot; Max 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* URL tab */}
            {tab === "url" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleLoadUrl()}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/40"
                  />
                  <button
                    onClick={handleLoadUrl}
                    disabled={!urlInput.trim()}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Load
                  </button>
                </div>
                {urlError && <p className="text-xs text-red-400/70">{urlError}</p>}
                <p className="text-[11px] text-white/20">Paste a direct image URL and click Load</p>
              </div>
            )}

            {/* Paste tab */}
            {tab === "paste" && (
              <div
                ref={pasteAreaRef}
                tabIndex={0}
                className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.01] focus:border-purple-500/30 focus:bg-purple-500/[0.02] transition-all outline-none"
              >
                <svg className="w-10 h-10 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                <p className="text-sm text-white/30">Press <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-[11px] font-mono text-white/50">Ctrl+V</kbd> to paste an image</p>
                <p className="text-[11px] text-white/15">Copy an image to your clipboard first</p>
              </div>
            )}
          </div>
        ) : (
          /* ── Cropper ── */
          <div>
            <div className="relative h-80 bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={cropShape}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
                </svg>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-purple-500 cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-lg"
                />
                <svg className="w-4 h-4 text-white/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => { setImageSrc(null); setZoom(1); setCrop({ x: 0, y: 0 }); }}
                className="px-4 py-2 text-xs font-medium text-white/40 border border-white/10 rounded-lg hover:bg-white/[0.04] hover:text-white/60 transition-all cursor-pointer"
              >
                Choose Different
              </button>
              <button
                onClick={handleSave}
                disabled={uploading || !croppedAreaPixels}
                className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
