"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ProductLightbox } from "@/components/pdp/ProductLightbox";

type Props = {
  coverUrl?: string | null;
  coverAlt?: string;
  bodyHtml: string;
  /** Video / excerpt nằm giữa cover và body */
  children?: ReactNode;
};

/**
 * Ảnh trong bài (không hiện ảnh đại diện card): cao ≈ ½ (viewport − header/nav).
 */
export function ArticleImageZoom({
  coverUrl,
  coverAlt = "",
  bodyHtml,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");

  const openZoom = useCallback((nextSrc: string, nextAlt = "") => {
    const s = String(nextSrc || "").trim();
    if (!s) return;
    setSrc(s);
    setAlt(nextAlt || "");
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {coverUrl ? (
        <button
          type="button"
          className="article-cover mb-6 block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left ring-1 ring-black/[0.04]"
          onClick={() => openZoom(coverUrl, coverAlt)}
          aria-label="Xem ảnh phóng to"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={coverAlt} className="article-cover__img" />
        </button>
      ) : null}

      {children}

      {bodyHtml ? (
        <div
          className="article-body max-w-none"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
          onClick={(e) => {
            const t = e.target as HTMLElement | null;
            const img = t?.closest?.("img") as HTMLImageElement | null;
            if (!img?.src) return;
            if (img.getAttribute("aria-hidden") === "true") return;
            e.preventDefault();
            openZoom(img.currentSrc || img.src, img.alt || coverAlt);
          }}
        />
      ) : null}

      <ProductLightbox open={open} src={src} alt={alt} onClose={close} />
    </>
  );
}
