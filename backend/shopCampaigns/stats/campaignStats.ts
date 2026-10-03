import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import { CAMPAIGN_STATS_COL } from "../types.js";
import { vnDayKey } from "../campaignPhase.js";

export type CampaignStatEvent = "remind" | "bannerClick" | "bannerView";

/** Doc đếm theo ngày: `_id = campaignId:YYYY-MM-DD`. Chỉ có số, không có dữ liệu cá nhân. */
type DayStatsDoc = {
  _id: string;
  kind: "day";
  campaignId: string;
  day: string;
  totals?: Partial<Record<CampaignStatEvent, number>>;
  reminds?: Record<string, number>;
  banners?: Record<string, number>;
  updatedAt: string;
};

/** Khoá chống đếm trùng "Nhắc tôi": chỉ giữ mã băm của khách, tự xoá sau khi chiến dịch kết thúc. */
type SeenDoc = { _id: string; kind: "seen"; campaignId: string; expireAt: Date };

function safeKey(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/[.$]/g, "_").slice(0, 64);
}

export function actorHash(actor: string): string {
  return createHash("sha256").update(`campaign-stat:${actor}`).digest("hex").slice(0, 24);
}

export async function ensureCampaignStatsIndexes(db: Db): Promise<void> {
  const col = db.collection(CAMPAIGN_STATS_COL);
  await col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { kind: "seen" } });
  await col.createIndex({ campaignId: 1, kind: 1, day: 1 });
}

async function bump(db: Db, campaignId: string, nowMs: number, inc: Record<string, number>): Promise<void> {
  const day = vnDayKey(nowMs);
  await db.collection<DayStatsDoc>(CAMPAIGN_STATS_COL).updateOne(
    { _id: `${campaignId}:${day}` },
    {
      $inc: inc,
      $set: { updatedAt: new Date(nowMs).toISOString() },
      $setOnInsert: { kind: "day", campaignId, day },
    },
    { upsert: true }
  );
}

/**
 * "Nhắc tôi": mỗi khách chỉ được đếm 1 lần cho mỗi sản phẩm trong 1 chiến dịch.
 * Chèn khoá `_id` duy nhất trước; trùng khoá nghĩa là đã đếm rồi.
 */
export async function recordRemind(
  db: Db,
  args: { campaignId: string; ma: string; actor: string; nowMs: number; campaignEndMs: number }
): Promise<{ counted: boolean }> {
  const ma = safeKey(args.ma);
  const seen: SeenDoc = {
    _id: `seen:remind:${args.campaignId}:${ma}:${actorHash(args.actor)}`,
    kind: "seen",
    campaignId: args.campaignId,
    expireAt: new Date(Math.max(args.campaignEndMs, args.nowMs) + 7 * 24 * 3600_000),
  };
  try {
    await db.collection<SeenDoc>(CAMPAIGN_STATS_COL).insertOne(seen);
  } catch (e: any) {
    if (e?.code === 11000) return { counted: false };
    throw e;
  }
  await bump(db, args.campaignId, args.nowMs, { "totals.remind": 1, [`reminds.${ma}`]: 1 });
  return { counted: true };
}

export async function recordBannerEvent(
  db: Db,
  args: { campaignId: string; bannerId: string; event: "bannerClick" | "bannerView"; nowMs: number }
): Promise<void> {
  const inc: Record<string, number> = { [`totals.${args.event}`]: 1 };
  if (args.event === "bannerClick") inc[`banners.${safeKey(args.bannerId)}`] = 1;
  await bump(db, args.campaignId, args.nowMs, inc);
}

export type CampaignStatsSummary = {
  totals: Record<CampaignStatEvent, number>;
  reminds: Record<string, number>;
  banners: Record<string, number>;
  byDay: { day: string; totals: Partial<Record<CampaignStatEvent, number>> }[];
};

/** Cộng dồn mọi ngày của 1 chiến dịch cho trang quản trị. */
export async function loadCampaignStats(db: Db, campaignId: string): Promise<CampaignStatsSummary> {
  const rows = await db
    .collection<DayStatsDoc>(CAMPAIGN_STATS_COL)
    .find({ campaignId, kind: "day" })
    .sort({ day: 1 })
    .toArray();
  const out: CampaignStatsSummary = {
    totals: { remind: 0, bannerClick: 0, bannerView: 0 },
    reminds: {},
    banners: {},
    byDay: [],
  };
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.totals || {})) out.totals[k as CampaignStatEvent] += Number(v) || 0;
    for (const [k, v] of Object.entries(r.reminds || {})) out.reminds[k] = (out.reminds[k] || 0) + (Number(v) || 0);
    for (const [k, v] of Object.entries(r.banners || {})) out.banners[k] = (out.banners[k] || 0) + (Number(v) || 0);
    out.byDay.push({ day: r.day, totals: r.totals || {} });
  }
  return out;
}
