import type { Db } from "mongodb";
import type { ActiveCampaign } from "../currentCampaign.js";
import { flashCounterId, isSelling, openSlotWindow } from "../campaignPhase.js";
import type { CampaignProduct } from "../types.js";
import { counterSnapshot, customerUsage, type CounterSpec } from "./flashCounters.js";
import type { FlashOffer } from "./flashTypes.js";

export const DEFAULT_PER_CUSTOMER_LIMIT = 2;

export type OpenFlashLine = { p: CampaignProduct; spec: CounterSpec };

/** Dòng khung giờ đứng trước dòng "Cả ngày" (giữ thứ tự gốc trong mỗi nhóm): giá khung được ưu tiên khi khung mở. */
export function slotRowsFirst(products: CampaignProduct[]): CampaignProduct[] {
  return [...products.filter((p) => p.slotKey), ...products.filter((p) => !p.slotKey)];
}

/** Dòng giá sale đang mở khung lúc `nowMs` (mỗi mã 1 dòng; dòng khung đang mở thắng dòng cả ngày). */
export function openFlashLines(active: ActiveCampaign, nowMs: number, mas?: Set<string>): OpenFlashLine[] {
  if (!isSelling(active.phase)) return [];
  const slots = new Map(active.content.slots.map((s) => [s.key, s]));
  const seen = new Set<string>();
  const out: OpenFlashLine[] = [];
  for (const p of slotRowsFirst(active.content.products)) {
    if (p.paused || !(p.salePrice > 0) || !(p.quota > 0) || seen.has(p.ma) || (mas && !mas.has(p.ma))) continue;
    const slot = p.slotKey ? slots.get(p.slotKey) || null : null;
    if (p.slotKey && !slot) continue;
    const win = openSlotWindow(slot, nowMs);
    if (!win) continue;
    seen.add(p.ma);
    const id = flashCounterId(active.id, win, p.slotKey, p.ma);
    out.push({ p, spec: { id, kind: "flash", campaignId: active.id, ma: p.ma, quota: p.quota } });
  }
  return out;
}

export function limitOf(perCustomerLimit: number): number {
  const n = Math.floor(Number(perCustomerLimit));
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_PER_CUSTOMER_LIMIT;
}

/** Suất còn lại theo bộ đếm + giới hạn còn lại của khách (khoá: tài khoản, SĐT). */
export async function loadFlashOffers(
  db: Db,
  active: ActiveCampaign,
  nowMs: number,
  mas: string[],
  customerKeys: string[]
): Promise<Map<string, FlashOffer>> {
  const lines = openFlashLines(active, nowMs, new Set(mas));
  if (!lines.length) return new Map();
  const ids = lines.map((l) => l.spec.id);
  const [counters, usage] = await Promise.all([counterSnapshot(db, ids), customerUsage(db, ids, customerKeys)]);
  const out = new Map<string, FlashOffer>();
  for (const { p, spec } of lines) {
    const c = counters.get(spec.id);
    const remaining = Math.max(0, p.quota - (c?.sold || 0) - (c?.held || 0));
    const customerRemaining = Math.max(0, limitOf(p.perCustomerLimit) - (usage.get(spec.id) || 0));
    out.set(p.ma, {
      campaignId: active.id,
      ma: p.ma,
      salePrice: p.salePrice,
      counterId: spec.id,
      quota: p.quota,
      perCustomerLimit: p.perCustomerLimit,
      remaining,
      customerRemaining,
    });
  }
  return out;
}

/** Nguồn "Còn x suất / Đã bán y%" cho card (đăng ký qua `setFlashStockLookupFactory`). */
export async function flashStockLookup(db: Db, active: ActiveCampaign, nowMs: number) {
  const lines = openFlashLines(active, nowMs);
  const counters = await counterSnapshot(db, lines.map((l) => l.spec.id));
  const byMa = new Map(lines.map((l) => [l.p.ma, l]));
  return (p: CampaignProduct) => {
    const line = byMa.get(p.ma);
    if (!line) return null;
    const c = counters.get(line.spec.id);
    const used = (c?.sold || 0) + (c?.held || 0);
    const remaining = Math.max(0, p.quota - used);
    return { remaining, soldPct: p.quota > 0 ? Math.min(100, Math.round((used / p.quota) * 100)) : 0, sold: used };
  };
}
