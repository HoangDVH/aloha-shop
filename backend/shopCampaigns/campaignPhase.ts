import type { CampaignInfo, CampaignPhase, CampaignSlot } from "./types.js";

/** Asia/Ho_Chi_Minh cố định UTC+7, không có giờ mùa hè. */
const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;
export const LAST_HOURS_MS = 6 * 3600_000;

/** "YYYY-MM-DD" theo giờ Việt Nam. */
export function vnDayKey(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Mốc 00:00 giờ Việt Nam của ngày chứa `ms` (epoch ms). */
export function vnMidnight(ms: number): number {
  return Math.floor((ms + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function getPhase(info: Pick<CampaignInfo, "startAt" | "endAt" | "teaserDays">, nowMs: number): CampaignPhase {
  const start = Date.parse(info.startAt);
  const end = Date.parse(info.endAt);
  if (nowMs >= end) return "ended";
  if (nowMs >= start) return nowMs >= end - LAST_HOURS_MS ? "lastHours" : "live";
  const teaserFrom = start - Math.max(0, info.teaserDays) * DAY_MS;
  return nowMs >= teaserFrom ? "teaser" : "upcoming";
}

/** Mốc kết thúc giai đoạn hiện tại (client đếm ngược tới đây). */
export function phaseEndsAt(info: Pick<CampaignInfo, "startAt" | "endAt" | "teaserDays">, phase: CampaignPhase): string | null {
  const start = Date.parse(info.startAt);
  const end = Date.parse(info.endAt);
  if (phase === "upcoming") return new Date(start - Math.max(0, info.teaserDays) * DAY_MS).toISOString();
  if (phase === "teaser") return info.startAt;
  if (phase === "live") return new Date(end - LAST_HOURS_MS).toISOString();
  if (phase === "lastHours") return info.endAt;
  return null;
}

export const isSelling = (phase: CampaignPhase) => phase === "live" || phase === "lastHours";

export type SlotWindow = { dayKey: string; startMs: number; endMs: number };

function windowFor(slot: CampaignSlot, midnight: number): SlotWindow {
  const startMs = midnight + minutesOf(slot.start) * 60_000;
  let endMs = midnight + minutesOf(slot.end) * 60_000;
  if (endMs <= startMs) endMs += DAY_MS;
  return { dayKey: vnDayKey(midnight), startMs, endMs };
}

/**
 * Khung đang mở lúc `nowMs`; khung qua nửa đêm tính cho ngày bắt đầu khung.
 * Không có khung (bán cả ngày) thì trả khung ALLDAY của hôm nay.
 */
export function openSlotWindow(slot: CampaignSlot | null, nowMs: number): SlotWindow | null {
  const today = vnMidnight(nowMs);
  if (!slot) return { dayKey: vnDayKey(today), startMs: today, endMs: today + DAY_MS };
  for (const midnight of [today, today - DAY_MS]) {
    const w = windowFor(slot, midnight);
    if (nowMs >= w.startMs && nowMs < w.endMs) return w;
  }
  return null;
}

/** Lần mở kế tiếp của khung (hôm nay hoặc ngày mai) khi đang đóng. */
export function nextSlotOpen(slot: CampaignSlot, nowMs: number): number {
  const today = vnMidnight(nowMs);
  const w = windowFor(slot, today);
  return w.startMs > nowMs ? w.startMs : windowFor(slot, today + DAY_MS).startMs;
}

/** `_id` bộ đếm suất: chiến dịch + ngày bắt đầu khung + khung + mã. */
export function flashCounterId(campaignId: string, win: SlotWindow, slotKey: string | undefined, ma: string): string {
  return `${campaignId}:${win.dayKey}:${slotKey || "ALLDAY"}:${ma}`;
}
