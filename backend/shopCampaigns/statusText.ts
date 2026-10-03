import { getPhase } from "./campaignPhase.js";
import type { CampaignDoc } from "./types.js";

const DAY_MS = 86_400_000;

/** "01/10 20:00" theo giờ Việt Nam. */
export function vnShortDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function remainingText(ms: number): string {
  if (ms >= DAY_MS) return `còn ${Math.ceil(ms / DAY_MS)} ngày`;
  if (ms >= 3600_000) return `còn ${Math.ceil(ms / 3600_000)} giờ`;
  return `còn ${Math.max(1, Math.ceil(ms / 60_000))} phút`;
}

export type CampaignStatusView = { tone: "green" | "amber" | "gray" | "red"; text: string; running: boolean };

/** Trạng thái bằng chữ đời thường cho danh sách admin (DB01), theo giờ server. */
export function campaignStatusText(doc: CampaignDoc, nowMs: number): CampaignStatusView {
  if (doc.status === "archived") return { tone: "gray", text: "Đã lưu trữ", running: false };
  const content = doc.published || doc.draft;
  if (doc.status === "draft") {
    return doc.scheduledAt
      ? { tone: "amber", text: `Hẹn bật · ${vnShortDateTime(doc.scheduledAt)}`, running: false }
      : { tone: "gray", text: "Bản nháp", running: false };
  }
  if (!content?.info.startAt || !content.info.endAt) return { tone: "gray", text: "Bản nháp", running: false };
  const phase = getPhase(content.info, nowMs);
  if (phase === "ended") return { tone: "gray", text: "Đã kết thúc", running: false };
  if (doc.status === "paused") return { tone: "red", text: "Tạm dừng", running: false };
  if (phase === "upcoming" || phase === "teaser") {
    const label = phase === "teaser" ? "Đang khởi động" : "Sắp chạy";
    return { tone: "amber", text: `${label} · ${vnShortDateTime(content.info.startAt)}`, running: phase === "teaser" };
  }
  const left = Date.parse(content.info.endAt) - nowMs;
  const label = phase === "lastHours" ? "Giờ chót" : "Đang chạy";
  return { tone: phase === "lastHours" ? "red" : "green", text: `${label} · ${remainingText(left)}`, running: true };
}
