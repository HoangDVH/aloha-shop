import type { Db } from "mongodb";
import { PROMOTIONS_COL, type PromotionDoc } from "../../shopPromotions/types.js";
import { isInvalidCampaign, validateCampaignContent } from "../schema.js";
import { quotaBelowUsed } from "../quotaGuard.js";
import { productGifts, type CampaignContent, type CampaignDoc, type CampaignSlot } from "../types.js";
import { loadProductFacts, type ProductFacts } from "./productFacts.js";

/**
 * error: khoá nút bật. confirm: bật được sau khi quản lý xác nhận lần 2 + nhập lý do.
 * warn: chỉ nhắc.
 */
export type CheckLevel = "error" | "confirm" | "warn";
export type CheckIssue = { level: CheckLevel; path: string; message: string };
export type PrepublishReport = {
  issues: CheckIssue[];
  facts: Record<string, ProductFacts>;
  content: CampaignContent | null;
};

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function slotRange(s: CampaignSlot): [number, number] {
  const a = toMin(s.start);
  const b = toMin(s.end);
  return [a, b <= a ? b + 1440 : b];
}

/** Khung qua đêm so cả với khung của ngày hôm sau (dịch 1440 phút). */
export function overlappingSlots(slots: CampaignSlot[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const [a1, a2] = slotRange(slots[i]);
      const [b1, b2] = slotRange(slots[j]);
      const hit = [-1440, 0, 1440].some((d) => a1 < b2 + d && b1 + d < a2);
      if (hit) out.push([i, j]);
    }
  }
  return out;
}

export function checkProducts(c: CampaignContent, facts: Map<string, ProductFacts>): CheckIssue[] {
  const issues: CheckIssue[] = [];
  c.products.forEach((p, i) => {
    const f = facts.get(p.ma);
    const at = `products.${i}`;
    if (!f) return void issues.push({ level: "error", path: `${at}.ma`, message: `${p.ma}: không tìm thấy sản phẩm trên web.` });
    productGifts(p).forEach((g, j) => {
      const gf = facts.get(g.ma);
      if (!gf) return void issues.push({ level: "error", path: `${at}.gifts.${j}.ma`, message: `Quà ${g.ma}: không tìm thấy sản phẩm.` });
      if (g.quota > gf.stock) {
        issues.push({ level: "warn", path: `${at}.gifts.${j}.quota`, message: `Quà ${gf.ten}: mở ${g.quota} suất nhưng kho chỉ còn ${gf.stock} cái.` });
      }
    });
    const anchor = p.compareAtPrice || 0;
    if (anchor > 0 && anchor <= f.listPrice) {
      issues.push({ level: "warn", path: `${at}.compareAtPrice`, message: `${f.ten}: giá trước KM ${vnd(anchor)} không cao hơn giá web ${vnd(f.listPrice)} — web sẽ không hiện giá gạch.` });
    } else if (anchor > f.listPrice * 2) {
      issues.push({ level: "warn", path: `${at}.compareAtPrice`, message: `${f.ten}: giá trước KM ${vnd(anchor)} cao gấp hơn 2 lần giá web ${vnd(f.listPrice)} — kiểm tra lại.` });
    }
    if (p.salePrice <= 0) return;
    if (p.salePrice >= f.listPrice) {
      issues.push({ level: "error", path: `${at}.salePrice`, message: `${f.ten}: giá sale ${vnd(p.salePrice)} phải thấp hơn giá thường ${vnd(f.listPrice)}.` });
      return;
    }
    if (f.cost > 0 && p.salePrice < f.cost) {
      issues.push({ level: "confirm", path: `${at}.salePrice`, message: `${f.ten}: giá sale ${vnd(p.salePrice)} thấp hơn giá vốn ${vnd(f.cost)} (lỗ ${vnd(f.cost - p.salePrice)}/cái).` });
    }
    if (p.salePrice < f.listPrice * 0.5) {
      issues.push({ level: "warn", path: `${at}.salePrice`, message: `${f.ten}: giảm hơn 50% — kiểm tra quy định khuyến mại trước khi bật.` });
    }
    if (p.quota > f.stock) {
      issues.push({ level: "warn", path: `${at}.quota`, message: `${f.ten}: mở ${p.quota} suất nhưng chỉ còn ${f.stock} cái.` });
    }
  });
  return issues;
}

export function checkVouchers(c: CampaignContent, vouchers: PromotionDoc[], nowMs: number): CheckIssue[] {
  const byId = new Map(vouchers.map((v) => [v.id, v]));
  const issues: CheckIssue[] = [];
  c.voucherIds.forEach((id, i) => {
    const v = byId.get(id);
    const path = `voucherIds.${i}`;
    if (!v) return void issues.push({ level: "error", path, message: `Voucher ${id} không còn tồn tại.` });
    const name = v.title || v.name;
    if (v.status !== "active") issues.push({ level: "error", path, message: `Voucher "${name}" đang không bật.` });
    else if (v.endDate && Date.parse(v.endDate) <= nowMs) issues.push({ level: "error", path, message: `Voucher "${name}" đã hết hạn.` });
    else if (v.targetCustomer === "wholesale") issues.push({ level: "error", path, message: `Voucher "${name}" dành cho khách sỉ, không dùng cho chiến dịch.` });
  });
  return issues;
}

async function contentIssues(db: Db, doc: CampaignDoc, c: CampaignContent, nowMs: number) {
  const mas = c.products.flatMap((p) => [p.ma, ...productGifts(p).map((g) => g.ma)]);
  const [facts, vouchers, below] = await Promise.all([
    loadProductFacts(db, mas),
    db.collection<PromotionDoc>(PROMOTIONS_COL).find({ id: { $in: c.voucherIds } }).toArray(),
    doc.published ? quotaBelowUsed(db, doc._id, c, nowMs) : Promise.resolve([]),
  ]);
  const issues: CheckIssue[] = [
    ...overlappingSlots(c.slots).map(([, j]) => ({ level: "error" as const, path: `slots.${j}.start`, message: `Khung ${c.slots[j].key} chồng giờ với khung khác.` })),
    ...checkProducts(c, facts),
    ...checkVouchers(c, vouchers, nowMs),
    ...below.map((message) => ({ level: "error" as const, path: "products", message })),
  ];
  return { issues, facts };
}

/** Chạy cả khi bấm "Kiểm tra" và ngay trước khi bật / hẹn giờ (server không tin client). */
export async function runPrepublishChecks(db: Db, doc: CampaignDoc, nowMs = Date.now()): Promise<PrepublishReport> {
  const v = validateCampaignContent(doc.draft);
  if (isInvalidCampaign(v)) {
    return { issues: v.fields.map((f) => ({ level: "error", path: f.path, message: f.message })), facts: {}, content: null };
  }
  const { issues, facts } = await contentIssues(db, doc, v.value, nowMs);
  return { issues, facts: Object.fromEntries(facts), content: v.value };
}
