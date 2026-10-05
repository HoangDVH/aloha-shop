/**
 * Voucher "túi mù": mức % giảm bốc ngẫu nhiên theo tỉ lệ khi khách lưu vào ví (kiểu Shopee/Lazada).
 * Server bốc, lưu cố định vào bản ghi ví; mọi báo giá / tạo đơn dùng mức đã bốc của đúng khách đó.
 */
import { randomInt } from "node:crypto";
import type { Db } from "mongodb";
import { PROMOTIONS_COL, type PromotionDoc } from "./types.js";

export type MysteryTier = {
  percent: number;
  /** Trọng số tương đối (thường nhập theo %, không bắt buộc cộng đủ 100). */
  weight: number;
  /** Số suất tối đa của mức này; null = không giới hạn. */
  limit: number | null;
  /** Suất còn lại (chỉ có nghĩa khi có `limit`). */
  remaining: number;
  drawn: number;
};

export type MysteryConfig = { tiers: MysteryTier[] };

export type PublicMystery = {
  min: number;
  max: number;
  tiers: { percent: number; chance: number }[];
  /** Mức khách này đã bốc (chỉ có khi đã lưu ví). */
  drawnPercent?: number;
};

export const MYSTERY_MAX_TIERS = 10;

type Parsed = { error: string; value?: undefined } | { error?: undefined; value: MysteryConfig | null | undefined };

/** Đọc + kiểm tra bảng mức từ body admin. `undefined` = body không gửi, `null` = tắt túi mù. */
export function parseMysteryConfig(raw: unknown): Parsed {
  if (raw === undefined) return { value: undefined };
  if (raw === null || raw === false) return { value: null };
  const tiersIn = Array.isArray((raw as { tiers?: unknown }).tiers) ? (raw as { tiers: unknown[] }).tiers : [];
  if (tiersIn.length < 2) return { error: "Túi mù cần ít nhất 2 mức giảm" };
  if (tiersIn.length > MYSTERY_MAX_TIERS) return { error: `Túi mù tối đa ${MYSTERY_MAX_TIERS} mức` };
  const seen = new Set<number>();
  const tiers: MysteryTier[] = [];
  for (const t of tiersIn as Record<string, unknown>[]) {
    const percent = Number(t?.percent);
    const weight = Number(t?.weight);
    const limitNum = Math.floor(Number(t?.limit) || 0);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      return { error: "Mức giảm túi mù phải là số nguyên từ 1 đến 100%" };
    }
    if (seen.has(percent)) return { error: `Mức ${percent}% bị trùng` };
    if (!Number.isFinite(weight) || weight <= 0) return { error: `Tỉ lệ của mức ${percent}% phải lớn hơn 0` };
    seen.add(percent);
    const limit = limitNum > 0 ? limitNum : null;
    tiers.push({ percent, weight, limit, remaining: limit ?? 0, drawn: 0 });
  }
  tiers.sort((a, b) => a.percent - b.percent);
  return { value: { tiers } };
}

export function isMystery(p: Pick<PromotionDoc, "mystery"> | null | undefined): boolean {
  return Boolean(p?.mystery?.tiers?.length);
}

export function mysteryRange(p: Pick<PromotionDoc, "mystery">): { min: number; max: number } | null {
  const tiers = p.mystery?.tiers || [];
  if (!tiers.length) return null;
  return { min: tiers[0].percent, max: tiers[tiers.length - 1].percent };
}

/** Phần gửi cho khách: khoảng %, tỉ lệ trúng (làm tròn) và mức đã bốc — không lộ số suất còn lại. */
export function publicMystery(p: Pick<PromotionDoc, "mystery" | "drawnPercent">): PublicMystery | undefined {
  const range = mysteryRange(p);
  if (!range) return undefined;
  const tiers = p.mystery!.tiers;
  const total = tiers.reduce((s, t) => s + t.weight, 0) || 1;
  return {
    ...range,
    tiers: tiers.map((t) => ({ percent: t.percent, chance: Math.round((t.weight / total) * 1000) / 10 })),
    ...(p.drawnPercent ? { drawnPercent: p.drawnPercent } : {}),
  };
}

const tierOpen = (t: MysteryTier) => t.limit == null || t.remaining > 0;

/** Chọn 1 mức theo trọng số trong các mức còn suất. `rand(n)` trả số nguyên [0, n). */
export function pickTier(tiers: MysteryTier[], rand: (n: number) => number = randomInt): MysteryTier | null {
  const open = tiers.filter(tierOpen);
  if (!open.length) return null;
  const scale = 1000;
  const weights = open.map((t) => Math.max(1, Math.round(t.weight * scale)));
  let r = rand(weights.reduce((s, w) => s + w, 0));
  for (let i = 0; i < open.length; i++) {
    if (r < weights[i]) return open[i];
    r -= weights[i];
  }
  return open[open.length - 1];
}

/** Giữ 1 suất của mức `percent` bằng một lệnh ghi: mức có giới hạn chỉ trừ khi còn suất. */
async function reserveTier(db: Db, promotionId: string, tier: MysteryTier): Promise<boolean> {
  const match =
    tier.limit == null
      ? { percent: tier.percent }
      : { percent: tier.percent, limit: tier.limit, remaining: { $gt: 0 } };
  const inc = tier.limit == null ? { "mystery.tiers.$.drawn": 1 } : { "mystery.tiers.$.drawn": 1, "mystery.tiers.$.remaining": -1 };
  const r = await db
    .collection<PromotionDoc>(PROMOTIONS_COL)
    .updateOne({ id: promotionId, "mystery.tiers": { $elemMatch: match } } as any, { $inc: inc } as any);
  return r.modifiedCount === 1;
}

/**
 * Bốc 1 mức cho khách. Mức vừa chọn hết suất (người khác lấy trước) thì bỏ mức đó và bốc lại
 * trong các mức còn lại; hết sạch suất trả null.
 */
export async function drawMysteryPercent(
  db: Db,
  promo: PromotionDoc,
  rand: (n: number) => number = randomInt
): Promise<number | null> {
  let tiers = (promo.mystery?.tiers || []).map((t) => ({ ...t }));
  for (let i = 0; i < MYSTERY_MAX_TIERS + 1; i++) {
    const tier = pickTier(tiers, rand);
    if (!tier) return null;
    if (await reserveTier(db, promo.id, tier)) return tier.percent;
    tiers = tiers.map((t) => (t.percent === tier.percent ? { ...t, remaining: 0, limit: t.limit ?? 0 } : t));
  }
  return null;
}

/** Bước bù khi ghi ví lỗi sau khi đã bốc: trả lại suất của mức đó. */
export async function returnMysteryDraw(db: Db, promotionId: string, percent: number): Promise<void> {
  const col = db.collection<PromotionDoc>(PROMOTIONS_COL);
  await col.updateOne(
    { id: promotionId, "mystery.tiers": { $elemMatch: { percent, limit: { $ne: null } } } } as any,
    { $inc: { "mystery.tiers.$.drawn": -1, "mystery.tiers.$.remaining": 1 } } as any
  );
  await col.updateOne(
    { id: promotionId, "mystery.tiers": { $elemMatch: { percent, limit: null } } } as any,
    { $inc: { "mystery.tiers.$.drawn": -1 } } as any
  );
}

/** Bản sao voucher theo khách: voucher túi mù dùng mức khách đã bốc (thiếu thì giữ mức thấp nhất). */
export function applyDrawnPercents(promos: PromotionDoc[], drawn: Map<string, number>): PromotionDoc[] {
  return promos.map((p) => {
    if (!isMystery(p)) return p;
    const pct = drawn.get(p.id);
    return pct ? { ...p, discountValue: pct, drawnPercent: pct } : p;
  });
}
