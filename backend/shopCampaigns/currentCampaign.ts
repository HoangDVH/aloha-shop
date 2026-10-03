import type { Db } from "mongodb";
import { syncBus } from "../syncBus.js";
import { getPhase } from "./campaignPhase.js";
import { CAMPAIGNS_COL, type CampaignContent, type CampaignDoc, type CampaignPhase } from "./types.js";

/** Cache RAM ngắn: tạm dừng khẩn cấp có hiệu lực ≤ 5 giây kể cả khi Redis tắt. */
const CACHE_TTL_MS = 5_000;
let cache: { at: number; docs: CampaignDoc[] } | null = null;

export function clearCurrentCampaignCache(): void {
  cache = null;
}

syncBus.on("change", (payload: { collections?: string[] }) => {
  if (payload?.collections?.includes(CAMPAIGNS_COL)) clearCurrentCampaignCache();
});

async function loadLiveDocs(db: Db, fresh: boolean): Promise<CampaignDoc[]> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.docs;
  const docs = await db
    .collection<CampaignDoc>(CAMPAIGNS_COL)
    .find(
      { status: { $in: ["published", "paused"] }, published: { $ne: null } },
      { projection: { draft: 0 } }
    )
    .toArray();
  cache = { at: Date.now(), docs };
  return docs;
}

export type ActiveCampaign = {
  id: string;
  content: CampaignContent;
  phase: CampaignPhase;
  publishedAt: string | null;
};

export type CurrentCampaignState = {
  /** Chiến dịch đang khởi động / chạy / giờ chót. */
  active: ActiveCampaign | null;
  /** Chiến dịch trong khung giờ nhưng admin đang tạm dừng. */
  pausedId: string | null;
  /** Chiến dịch sắp tới gần nhất (hiện ở trang /uu-dai khi đã kết thúc). */
  upcoming: ActiveCampaign | null;
};

export type ViewerScope = { isTestBuyer: boolean };

const visibleTo = (content: CampaignContent, viewer: ViewerScope) => !content.info.testOnly || viewer.isTestBuyer;

function toActive(doc: CampaignDoc, nowMs: number): ActiveCampaign {
  const content = doc.published as CampaignContent;
  return { id: doc._id, content, phase: getPhase(content.info, nowMs), publishedAt: doc.publishedAt };
}

export function pickCurrent(docs: CampaignDoc[], nowMs: number, viewer: ViewerScope): CurrentCampaignState {
  const candidates = docs.filter((d) => d.published && visibleTo(d.published, viewer)).map((d) => ({ d, a: toActive(d, nowMs) }));
  const running = candidates.filter((c) => c.a.phase !== "ended" && c.a.phase !== "upcoming");
  const active = running.find((c) => c.d.status === "published")?.a || null;
  const pausedId = active ? null : running.find((c) => c.d.status === "paused")?.d._id || null;
  const upcoming =
    candidates
      .filter((c) => c.d.status === "published" && c.a.phase === "upcoming")
      .sort((x, y) => Date.parse(x.a.content.info.startAt) - Date.parse(y.a.content.info.startAt))[0]?.a || null;
  return { active, pausedId, upcoming };
}

/** Mọi voucher đang gắn với chiến dịch đã bật (kể cả tạm dừng) — chỉ khách lẻ được dùng. */
export async function liveCampaignVoucherIds(db: Db): Promise<Set<string>> {
  const docs = await loadLiveDocs(db, false);
  return new Set(docs.flatMap((d) => d.published?.voucherIds || []));
}

/**
 * Chiến dịch hiện hành theo giờ server. `fresh` bỏ qua cache — dùng khi báo giá / tạo đơn
 * để trạng thái tạm dừng mới nhất luôn được tôn trọng.
 */
export async function getCurrentCampaign(
  db: Db,
  nowMs: number,
  viewer: ViewerScope,
  opts: { fresh?: boolean } = {}
): Promise<CurrentCampaignState> {
  const docs = await loadLiveDocs(db, Boolean(opts.fresh));
  return pickCurrent(docs, nowMs, viewer);
}
