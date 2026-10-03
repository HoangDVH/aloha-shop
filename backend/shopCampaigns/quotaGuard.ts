import type { Db } from "mongodb";
import { vnDayKey } from "./campaignPhase.js";
import { CAMPAIGN_ADMIN_MESSAGES as M } from "./messages.js";
import { FLASH_COUNTERS_COL, productGifts, type CampaignContent } from "./types.js";

const DAY_MS = 86_400_000;

function quotaKeys(content: CampaignContent): Map<string, { ma: string; quota: number }> {
  const out = new Map<string, { ma: string; quota: number }>();
  for (const p of content.products) {
    out.set(`flash|${p.slotKey || "ALLDAY"}:${p.ma}`, { ma: p.ma, quota: p.quota });
    for (const g of productGifts(p)) out.set(`gift|${p.ma}:${g.ma}`, { ma: g.ma, quota: g.quota });
  }
  return out;
}

/**
 * Sửa chiến dịch đang chạy: số lượng mới không được thấp hơn số đã bán + đang giữ của khung
 * còn hiệu lực (từ hôm qua, vì khung qua đêm tính theo ngày bắt đầu). Tăng thì luôn được.
 */
export async function quotaBelowUsed(db: Db, campaignId: string, content: CampaignContent, nowMs = Date.now()): Promise<string[]> {
  const minDay = vnDayKey(nowMs - DAY_MS);
  const keys = quotaKeys(content);
  const rows = await db
    .collection(FLASH_COUNTERS_COL)
    .find({ campaignId, kind: { $in: ["flash", "gift"] } }, { projection: { kind: 1, held: 1, sold: 1 } })
    .toArray();
  const errors: string[] = [];
  for (const r of rows) {
    const parts = String(r._id).split(":");
    let key: string;
    if (r.kind === "flash") {
      const [, dayKey, slot, ma] = parts;
      if (dayKey < minDay) continue;
      key = `flash|${slot}:${ma}`;
    } else {
      const [, , parent, gift] = parts;
      key = `gift|${parent}:${gift}`;
    }
    const want = keys.get(key);
    const used = (Number(r.sold) || 0) + (Number(r.held) || 0);
    if (want && want.quota < used) errors.push(M.quotaBelowUsed(want.ma, used, want.quota));
  }
  return [...new Set(errors)];
}
