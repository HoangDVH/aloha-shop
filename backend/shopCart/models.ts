import type { Db } from "mongodb";
import { normalizeCtvCode } from "../shopAuth/models.js";

export const SHOP_CARTS = "aloha_shop_carts";

export type CartLineDoc = {
  ma: string;
  ten: string;
  gia: number;
  anh: string;
  path: string;
  qty: number;
  dvt: string;
  /** Biến thể đã chọn — giữ khi sync giỏ */
  attributes?: Array<{ attributeName: string; attributeValue: string }>;
  /** Ghi chú riêng dòng SP */
  lineNote?: string;
  ton?: number;
  trongLuong?: number;
  selected: boolean;
  ctv?: string;
};

function normalizeAttrs(
  raw: unknown
): Array<{ attributeName: string; attributeValue: string }> | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: Array<{ attributeName: string; attributeValue: string }> = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const attributeName = String(o.attributeName || o.name || "").trim();
    const attributeValue = String(o.attributeValue || o.value || "").trim();
    if (!attributeName && !attributeValue) continue;
    out.push({ attributeName, attributeValue });
  }
  return out.length ? out : undefined;
}

export function normalizeCartLine(raw: unknown): CartLineDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ma = String(o.ma || "").trim();
  if (!ma) return null;
  const qty = Math.floor(Number(o.qty) || 0);
  if (qty <= 0) return null;
  const ctv = normalizeCtvCode(String(o.ctv || "")) || undefined;
  const attributes = normalizeAttrs(o.attributes);
  const lineNote = String(o.lineNote || "").trim().slice(0, 200) || undefined;
  const ton =
    o.ton != null && Number.isFinite(Number(o.ton)) ? Number(o.ton) : undefined;
  const trongLuong =
    o.trongLuong != null && Number.isFinite(Number(o.trongLuong))
      ? Number(o.trongLuong)
      : undefined;
  return {
    ma,
    ten: String(o.ten || ma).trim(),
    gia: Math.max(0, Math.round(Number(o.gia) || 0)),
    anh: String(o.anh || "").trim(),
    path: String(o.path || "").trim(),
    qty,
    dvt: String(o.dvt || "Cái").trim() || "Cái",
    ...(attributes ? { attributes } : {}),
    ...(lineNote ? { lineNote } : {}),
    ...(ton != null ? { ton } : {}),
    ...(trongLuong != null ? { trongLuong } : {}),
    selected: o.selected !== false,
    ...(ctv ? { ctv } : {}),
  };
}

export function normalizeCartLines(raw: unknown): CartLineDoc[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, CartLineDoc>();
  for (const item of raw) {
    const line = normalizeCartLine(item);
    if (!line) continue;
    const prev = map.get(line.ma);
    if (!prev) {
      map.set(line.ma, line);
      continue;
    }
    map.set(line.ma, mergeTwoLines(prev, line));
  }
  return [...map.values()];
}

function mergeTwoLines(a: CartLineDoc, b: CartLineDoc): CartLineDoc {
  const pick = (a.gia > 0 ? a : b.gia > 0 ? b : a) as CartLineDoc;
  return {
    ma: a.ma,
    ten: pick.ten || a.ten || b.ten,
    gia: pick.gia || a.gia || b.gia,
    anh: pick.anh || a.anh || b.anh,
    path: pick.path || a.path || b.path,
    dvt: pick.dvt || a.dvt || b.dvt,
    attributes: pick.attributes || a.attributes || b.attributes,
    lineNote: pick.lineNote || a.lineNote || b.lineNote,
    ton: pick.ton ?? a.ton ?? b.ton,
    trongLuong: pick.trongLuong ?? a.trongLuong ?? b.trongLuong,
    qty: a.qty + b.qty,
    selected: a.selected || b.selected,
    ctv: a.ctv || b.ctv,
  };
}

/** Gộp giỏ khách (máy hiện tại) vào giỏ tài khoản — cộng SL cùng mã SP. */
export function mergeCartLines(server: CartLineDoc[], guest: CartLineDoc[]): CartLineDoc[] {
  const map = new Map<string, CartLineDoc>();
  for (const line of server) map.set(line.ma, { ...line });
  for (const line of guest) {
    const prev = map.get(line.ma);
    map.set(line.ma, prev ? mergeTwoLines(prev, line) : { ...line });
  }
  return [...map.values()];
}

export async function ensureShopCartIndexes(db: Db) {
  try {
    await db
      .collection(SHOP_CARTS)
      .createIndex({ userId: 1 }, { unique: true, background: true });
    await db
      .collection(SHOP_CARTS)
      .createIndex({ updatedAt: -1 }, { background: true });
  } catch (e) {
    console.warn("[shopCart] ensureShopCartIndexes:", e);
  }
}
