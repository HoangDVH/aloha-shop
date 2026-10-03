"use client";

import { useMemo } from "react";
import { useCampaignView } from "./useCampaignView";

const FALLBACK = "#C8102E";
const MIN_CONTRAST = 4.5;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function contrastOnWhite([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05);
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** Màu chữ đọc được trên nền trắng (WCAG AA 4.5:1) — giữ sắc màu chiến dịch, chỉ tối dần khi quá nhạt. */
export function readableOnWhite(color: string | undefined | null): string {
  let rgb = color ? parseHex(color) : null;
  if (!rgb) return FALLBACK;
  for (let i = 0; i < 12 && contrastOnWhite(rgb) < MIN_CONTRAST; i++) {
    rgb = rgb.map((c) => c * 0.88) as [number, number, number];
  }
  return contrastOnWhite(rgb) >= MIN_CONTRAST ? toHex(rgb) : FALLBACK;
}

/** Điểm nhấn mục "Ưu đãi" trên menu khi chiến dịch đang chạy. */
export function useDealsNavAccent(): { on: boolean; color: string } {
  const { campaign } = useCampaignView();
  const primary = campaign?.display?.colors?.primary;
  return useMemo(() => ({ on: Boolean(campaign), color: readableOnWhite(primary) }), [campaign, primary]);
}
