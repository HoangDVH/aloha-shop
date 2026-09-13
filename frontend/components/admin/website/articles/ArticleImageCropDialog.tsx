"use client";

import React, { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Loader2, RotateCcw, X } from "lucide-react";
import { getCroppedImageDataUrl } from "./articleMediaUtils";

type Props = {
  open: boolean;
  imageSrc: string;
  /** null = free aspect (giữ tỷ lệ vùng kéo); số = khóa tỷ lệ (cover 1:1) */
  aspect?: number | null;
  title?: string;
  busy?: boolean;
  onCancel: () => void;
  onApply: (croppedDataUrl: string) => void | Promise<void>;
};

/**
 * Cắt ảnh trực quan (zoom / kéo). Xuất đủ độ phân giải vùng cắt — không làm mờ.
 */
export function ArticleImageCropDialog({
  open,
  imageSrc,
  aspect = null,
  title = "Cắt ảnh",
  busy = false,
  onCancel,
  onApply,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const apply = async () => {
    if (!croppedAreaPixels || applying || busy) return;
    setApplying(true);
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels);
      await onApply(dataUrl);
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const saving = applying || busy;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            <p className="text-[12px] text-slate-500">
              Kéo ảnh · lăn chuột / thanh zoom · giữ tỷ lệ · Lưu không làm mờ
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={onCancel}
            disabled={saving}
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-[min(52vh,420px)] bg-slate-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect ?? undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            showGrid
          />
        </div>

        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          <label className="flex items-center gap-3 text-[13px] text-slate-700">
            <span className="w-12 shrink-0 font-semibold">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#3D6B3A]"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100"
              onClick={reset}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100"
                onClick={onCancel}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-[#3D6B3A] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#345c32] disabled:opacity-60"
                onClick={() => void apply()}
                disabled={saving || !croppedAreaPixels}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Lưu ảnh cắt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
