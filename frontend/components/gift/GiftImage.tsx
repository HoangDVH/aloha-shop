"use client";

import { useState } from "react";

const fallbackImages: Record<string, string> = {
  "nguoi-thuong": "/banners/ve-aloha/real-hong-ngoc-2010.jpg",
  "gia-dinh": "/banners/ve-aloha/real-binh-an.jpg",
  "khai-truong": "/banners/ve-aloha/real-hanh-phuc.jpg",
  "ban-lam-viec": "/banners/ve-aloha/real-sen-da.jpg",
  "doanh-nghiep": "/banners/trust/dich-vu-goi-qua.webp",
};

export function GiftImage({ src, slug, alt, className }: {
  src: string; slug: string; alt: string; className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallback = fallbackImages[slug] || fallbackImages["nguoi-thuong"];
  const image = !src || failedSrc === src ? fallback : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image} alt={alt} className={className} onError={() => {
    if (image !== fallback) setFailedSrc(src);
  }} />;
}
