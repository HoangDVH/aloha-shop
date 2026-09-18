"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Crop,
  ImagePlus,
  Trash2,
  X,
} from "lucide-react";
import {
  readImgAlign,
  readImgWidthPercent,
  setImgAlign,
  setImgFreeBox,
  setImgWidthPercent,
  type ImgAlign,
} from "./articleMediaUtils";

/** 8 điểm kéo kiểu Word: 4 góc + giữa trên/dưới/trái/phải */
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

type Props = {
  images: HTMLImageElement[];
  editorEl: HTMLElement | null;
  onClear: () => void;
  onDelete: () => void;
  onCrop: (img: HTMLImageElement) => void;
  onReplace: (img: HTMLImageElement) => void;
  onAltChange: (img: HTMLImageElement, alt: string) => void;
  onWidthChange: () => void;
  /** Mobile: thanh dưới */
  isNarrow: boolean;
};

function handleCursor(h: Handle): string {
  switch (h) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    default:
      return "nwse-resize";
  }
}

function handlePosition(h: Handle, size: number): React.CSSProperties {
  const half = size / 2;
  const pos: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    margin: 0,
  };
  if (h.includes("n")) pos.top = -half;
  else if (h.includes("s")) pos.bottom = -half;
  else {
    pos.top = "50%";
    pos.marginTop = -half;
  }
  if (h.includes("w")) pos.left = -half;
  else if (h.includes("e")) pos.right = -half;
  else {
    pos.left = "50%";
    pos.marginLeft = -half;
  }
  return pos;
}

/**
 * Khung chọn ảnh kiểu Word: 8 chấm tròn.
 * - 4 góc: giữ tỷ lệ (không méo)
 * - Giữa trái/phải: chỉ kéo ngang (đổi rộng, giữ cao) — như Word khi không khóa tỷ lệ
 * - Giữa trên/dưới: chỉ kéo dọc (đổi cao, giữ rộng)
 */
export function ArticleInlineImageOverlay({
  images,
  editorEl,
  onClear,
  onDelete,
  onCrop,
  onReplace,
  onAltChange,
  onWidthChange,
  isNarrow,
}: Props) {
  const [boxes, setBoxes] = useState<DOMRect[]>([]);
  const primary = images[0] || null;
  const multi = images.length > 1;
  const [alt, setAlt] = useState(primary?.alt || "");
  const [widthPct, setWidthPct] = useState(primary ? readImgWidthPercent(primary) : 100);
  const [align, setAlign] = useState<ImgAlign>(primary ? readImgAlign(primary) : "left");

  const refresh = () => {
    setBoxes(images.map((img) => img.getBoundingClientRect()));
    if (primary) {
      setWidthPct(readImgWidthPercent(primary));
      setAlt(primary.alt || "");
      setAlign(readImgAlign(primary));
    }
  };

  useEffect(() => {
    refresh();
    const onScroll = () => refresh();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const ro = editorEl ? new ResizeObserver(onScroll) : null;
    if (editorEl && ro) ro.observe(editorEl);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, editorEl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClear();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !(e.target as HTMLElement)?.closest?.("input,textarea")
      ) {
        e.preventDefault();
        onDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClear, onDelete]);

  const startResize = (e: React.PointerEvent, handle: Handle, img: HTMLImageElement) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPct = readImgWidthPercent(img);
    const startW = Math.max(1, img.clientWidth);
    const startH = Math.max(1, img.clientHeight);
    const parentW = img.parentElement?.clientWidth || startW;
    const isMidSide = handle === "n" || handle === "s" || handle === "e" || handle === "w";
    const isCorner = !isMidSide;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (handle === "e") {
        // Chỉ chiều ngang — giữ nguyên chiều cao
        const newW = Math.max(40, startW + dx);
        const pct = (newW / parentW) * 100;
        setImgFreeBox(img, pct, startH);
      } else if (handle === "w") {
        const newW = Math.max(40, startW - dx);
        const pct = (newW / parentW) * 100;
        setImgFreeBox(img, pct, startH);
      } else if (handle === "s") {
        // Chỉ chiều dọc — giữ nguyên chiều rộng
        const newH = Math.max(40, startH + dy);
        setImgFreeBox(img, startPct, newH);
      } else if (handle === "n") {
        const newH = Math.max(40, startH - dy);
        setImgFreeBox(img, startPct, newH);
      } else if (isCorner) {
        // Góc: giữ tỷ lệ
        const sign = handle === "nw" || handle === "sw" ? -1 : 1;
        const deltaPct = ((dx * sign) / parentW) * 100;
        setImgWidthPercent(img, startPct + deltaPct);
      }

      setWidthPct(readImgWidthPercent(img));
      refresh();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onWidthChange();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const applyPreset = (pct: number) => {
    for (const img of images) setImgWidthPercent(img, pct);
    setWidthPct(pct);
    onWidthChange();
    refresh();
  };

  const applyAlign = (next: ImgAlign) => {
    for (const img of images) setImgAlign(img, next);
    setAlign(next);
    setWidthPct(primary ? readImgWidthPercent(primary) : widthPct);
    onWidthChange();
    // Đợi layout xong rồi cập nhật khung chọn
    requestAnimationFrame(() => refresh());
  };

  const toolbar = useMemo(() => {
    if (!primary) return null;
    const alignBtn = (a: ImgAlign, Icon: typeof AlignLeft, title: string) => (
      <button
        key={a}
        type="button"
        title={title}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
          align === a
            ? "bg-[#0F9D58]/15 text-[#0F9D58]"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        onClick={() => applyAlign(a)}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
    return (
      <div
        className={`flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg ${
          isNarrow ? "w-full justify-center" : ""
        }`}
      >
        {!multi ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => onCrop(primary)}
            >
              <Crop className="h-3.5 w-3.5" />
              Cắt
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => onReplace(primary)}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Thay
            </button>
          </>
        ) : null}
        <span className="mx-0.5 h-5 w-px bg-slate-200" />
        {alignBtn("left", AlignLeft, "Sát trái (như Word)")}
        {alignBtn("center", AlignCenter, "Giữa trang (như Word)")}
        {alignBtn("right", AlignRight, "Sát phải (như Word)")}
        <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block" />
        {[100, 75, 50].map((p) => (
          <button
            key={p}
            type="button"
            className={`rounded-lg px-2 py-1.5 text-[12px] font-bold ${
              Math.abs(widthPct - p) < 3
                ? "bg-[#0F9D58]/10 text-[#0F9D58]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => applyPreset(p)}
          >
            {p}%
          </button>
        ))}
        {isNarrow || multi ? (
          <input
            type="range"
            min={20}
            max={100}
            value={Math.round(widthPct)}
            onChange={(e) => applyPreset(Number(e.target.value))}
            className="mx-1 w-24 accent-[#0F9D58] sm:w-32"
            aria-label="Độ rộng ảnh"
          />
        ) : null}
        {!multi ? (
          <input
            className="ml-1 hidden min-w-[100px] max-w-[160px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-[12px] sm:block"
            placeholder="Mô tả ảnh (alt)"
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
              onAltChange(primary, e.target.value);
            }}
          />
        ) : (
          <span className="px-2 text-[12px] font-semibold text-slate-500">
            {images.length} ảnh
          </span>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Xóa
        </button>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          onClick={onClear}
          aria-label="Bỏ chọn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, multi, widthPct, alt, align, isNarrow, images.length]);

  if (!images.length || !boxes.length) return null;

  const first = boxes[0];
  const toolbarStyle: React.CSSProperties = isNarrow
    ? {
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 12,
        zIndex: 70,
      }
    : {
        position: "fixed",
        left: Math.max(8, first.left),
        top: Math.max(8, first.top - 48),
        zIndex: 70,
      };

  const handleSize = isNarrow ? 16 : 11;

  return createPortal(
    <>
      {images.map((img, i) => {
        const r = boxes[i];
        if (!r) return null;
        return (
          <div
            key={i}
            className="pointer-events-none fixed z-[69] box-border border-2 border-[#5B9BD5] shadow-[0_0_0_1px_rgba(91,155,213,0.35)]"
            style={{
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
            }}
          >
            {!multi
              ? HANDLES.map((h) => (
                  <div
                    key={h}
                    title={
                      h === "n" || h === "s"
                        ? "Kéo giữa cạnh: chỉ đổi chiều cao"
                        : h === "e" || h === "w"
                          ? "Kéo giữa cạnh: chỉ đổi chiều rộng"
                          : "Kéo góc: giữ tỷ lệ"
                    }
                    style={{
                      ...handlePosition(h, handleSize),
                      background: "#fff",
                      border: "1.5px solid #5B9BD5",
                      borderRadius: "50%",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.18)",
                      pointerEvents: "auto",
                      cursor: handleCursor(h),
                      zIndex: 2,
                    }}
                    onPointerDown={(e) => startResize(e, h, img)}
                  />
                ))
              : null}
          </div>
        );
      })}
      <div style={toolbarStyle} className="pointer-events-auto">
        {toolbar}
      </div>
    </>,
    document.body
  );
}
