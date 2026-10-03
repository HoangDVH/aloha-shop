import type { CampaignUI } from "./campaignApi";

/** Khung giờ đang mở theo giờ Việt Nam; khung qua đêm (22:00–02:00) tính cả phần sau nửa đêm. */
export function currentSlotKey(slots: CampaignUI["slots"], nowMs: number): string | null {
  const d = new Date(nowMs + 7 * 3600_000);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  for (const s of slots) {
    const a = toMin(s.start);
    const b = toMin(s.end);
    const open = a < b ? mins >= a && mins < b : mins >= a || mins < b;
    if (open) return s.key;
  }
  return null;
}
