"use client";

import { useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/api";
import { ProductVideoLightbox } from "./ProductVideoLightbox";

export function AttachedProductImage({ item, compact = false }: { item: ShopProduct; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const images = useMemo(() => [...new Set(
    [item.anh, ...(item.images || [])]
      .filter((src): src is string => typeof src === "string")
      .map((src) => src.trim())
      .filter(Boolean)
  )], [item.anh, item.images]);
  const media = useMemo(() => images.map((src) => ({ kind: "image" as const, src })), [images]);

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!images.length}
          aria-label={images.length ? `Xem ảnh phóng to ${item.ten}` : `${item.ten} chưa có ảnh`}
          title={images.length ? "Bấm để xem ảnh phóng to" : "Chưa có ảnh"}
          className="relative flex h-11 w-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-stone-200/90 bg-white shadow-2xs hover:border-[var(--aloha-green,#2e7d32)] focus-visible:outline-2"
        >
          {images.length ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[0]}
                alt={item.ten}
                loading="lazy"
                className="h-full w-full object-cover transition duration-200 hover:scale-105"
              />
              {images.length > 1 ? (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 py-0.2 text-[8px] font-bold text-white leading-none">
                  {images.length}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[10px] text-slate-400">Ảnh</span>
          )}
        </button>
        {open && images.length ? (
          <ProductVideoLightbox
            open
            startIndex={0}
            media={media}
            poster={images[0]}
            alt={item.ten}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!images.length}
        aria-label={images.length ? `Xem ảnh phóng to ${item.ten}` : `${item.ten} chưa có ảnh`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={images.length ? "Bấm để xem ảnh phóng to" : "Chưa có ảnh"}
        className="group flex w-15 shrink-0 cursor-zoom-in flex-col items-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-default sm:w-16"
      >
        <span className="flex h-15 w-full items-center justify-center overflow-hidden rounded-lg border border-[#e8e2d8] bg-white sm:h-16">
          {images.length ? (
            <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[0]} alt={item.ten} loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            </>
          ) : <span className="text-xs text-slate-400">Ảnh</span>}
        </span>
        {images.length ? (
          <span aria-hidden="true" className="text-[10px] leading-3 text-emerald-700 group-hover:underline">
            {images.length > 1 ? `Xem ${images.length} ảnh` : "Phóng to"}
          </span>
        ) : null}
      </button>
      {open && images.length ? (
        <ProductVideoLightbox
          open
          startIndex={0}
          media={media}
          poster={images[0]}
          alt={item.ten}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
