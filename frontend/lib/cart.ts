"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShopProduct, ShopProductAttr } from "./api";
import { getGuestCtvCode, normalizeCtvCode } from "./ctv";
import { normalizeCartAttributes } from "./cartVariant";

export type CartLine = {
  ma: string;
  ten: string;
  gia: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
  anh: string;
  path: string;
  qty: number;
  dvt: string;
  /** Thuộc tính biến thể đã chọn (màu, size…) — hiện checkout / đơn */
  attributes?: ShopProductAttr[];
  /** Ghi chú riêng dòng SP (checkout) */
  lineNote?: string;
  /** Tồn kho lúc thêm/cập nhật — giới hạn số lượng mua */
  ton?: number;
  /** Gram hoặc kg (KiotViet) — server tự quy đổi khi báo giá ship */
  trongLuong?: number;
  selected: boolean;
  ctv?: string;
};

export type CartAddResult = {
  ok: boolean;
  qty: number;
  max: number | null;
  capped: boolean;
  /** Thêm khi ton đã biết và ≤ 0 */
  preOrder?: boolean;
};

/** Tồn tối đa có thể đặt; null = chưa biết (chưa sync). */
export function stockMax(ton: number | undefined | null): number | null {
  if (ton == null || !Number.isFinite(Number(ton))) return null;
  return Math.max(0, Math.floor(Number(ton)));
}

/**
 * Hiển thị tồn kho (TMĐT): làm sạch lỗi float rồi làm tròn xuống số nguyên ≥ 0.
 * VD: 61.459000000000001 → "61"
 */
export function formatTonDisplay(ton: number | undefined | null): string {
  const max = stockMax(ton);
  if (max == null) return "0";
  return String(max);
}

/** Đặt trước khi tồn đã biết và ≤ 0. */
export function isPreOrderTon(ton: number | undefined | null, quantity = 1): boolean {
  const max = stockMax(ton);
  return max != null && quantity > max;
}

/** Giới hạn qty theo tồn; qty ≤ 0 → 0 (xóa dòng). Đặt trước: không cap theo ton=0. */
export function clampQtyToStock(
  qty: number,
  ton: number | undefined | null,
  allowBackorder = true
): number {
  const q = Number.isFinite(qty) ? Math.min(10000, Math.floor(qty)) : 0;
  if (q <= 0) return 0;
  const max = stockMax(ton);
  if (max == null || allowBackorder) return q;
  return Math.min(q, max);
}

type CartState = {
  lines: CartLine[];
  add: (p: ShopProduct, qty?: number, ctvCode?: string) => CartAddResult;
  setQty: (ma: string, qty: number) => void;
  setLineNote: (ma: string, note: string) => void;
  remove: (ma: string) => void;
  clear: () => void;
  toggleSelected: (ma: string) => void;
  setAllSelected: (selected: boolean) => void;
  removeSelected: () => void;
  /** Thay toàn bộ giỏ — dùng khi đồng bộ từ server. */
  replaceLines: (lines: CartLine[]) => void;
  /** Cập nhật giá/tên/ảnh/tồn theo catalog (giữ selected; kẹp qty theo tồn). */
  patchCatalog: (
    updates: Array<{
      ma: string;
      gia?: number;
      priceKind?: "web" | "si" | "si_missing";
      allowBackorder?: boolean;
      ton?: number;
      ten?: string;
      anh?: string;
      path?: string;
      dvt?: string;
      trongLuong?: number;
      attributes?: ShopProductAttr[];
    }>
  ) => void;
  selectedCount: () => number;
  selectedTotal: () => number;
  count: () => number;
  total: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (p, qty = 1, ctvCode = "") => {
        if (p.priceKind === "si_missing" || !(p.gia > 0)) return { ok: false, qty: 0, max: 0, capped: false };
        const want = Math.max(1, Math.floor(qty));
        const ctv = normalizeCtvCode(ctvCode || getGuestCtvCode());
        const max = stockMax(p.ton);
        const preOrder = isPreOrderTon(p.ton);
        let result: CartAddResult = {
          ok: true,
          qty: want,
          max,
          capped: false,
          preOrder,
        };

        set((s) => {
          const i = s.lines.findIndex((l) => l.ma === p.ma);
          const existing = i >= 0 ? s.lines[i].qty : 0;
          const nextQty = clampQtyToStock(existing + want, p.ton, p.allowBackorder !== false);

          if (nextQty <= 0) {
            result = { ok: false, qty: 0, max, capped: true, preOrder };
            return s;
          }

          result = {
            ok: nextQty > existing,
            qty: nextQty,
            max,
            capped: nextQty < existing + want,
            preOrder: isPreOrderTon(p.ton, nextQty),
          };

          if (i >= 0) {
            const next = [...s.lines];
            next[i] = {
              ...next[i],
              qty: nextQty,
              selected: true,
              ton: max ?? next[i].ton,
              ctv: next[i].ctv || ctv || undefined,
              gia: Number(p.gia),
              priceKind: p.priceKind,
              allowBackorder: p.allowBackorder,
              ten: p.ten || next[i].ten,
              anh: p.anh || next[i].anh,
              path: p.path || next[i].path,
              dvt: p.dvt || next[i].dvt || "Cái",
              attributes:
                normalizeCartAttributes(p.attributes) || next[i].attributes,
              trongLuong: p.trongLuong ?? next[i].trongLuong,
            };
            return { lines: next };
          }

          return {
            lines: [
              ...s.lines,
              {
                ma: p.ma,
                ten: p.ten,
                gia: p.gia,
                priceKind: p.priceKind,
                allowBackorder: p.allowBackorder,
                anh: p.anh,
                path: p.path,
                qty: nextQty,
                dvt: p.dvt || "Cái",
                attributes: normalizeCartAttributes(p.attributes),
                ton: max ?? undefined,
                trongLuong: p.trongLuong,
                selected: true,
                ctv: ctv || undefined,
              },
            ],
          };
        });

        return result;
      },
      patchCatalog: (updates) => {
        if (!updates.length) return;
        const map = new Map(
          updates.map((u) => [String(u.ma || "").trim().toUpperCase(), u])
        );
        set((s) => ({
          lines: s.lines
            .map((l) => {
              const u = map.get(String(l.ma || "").trim().toUpperCase());
              if (!u) return l;
              const ton =
                u.ton != null && Number.isFinite(Number(u.ton))
                  ? Number(u.ton)
                  : l.ton;
              const qty = clampQtyToStock(l.qty, ton, (u.allowBackorder ?? l.allowBackorder) !== false);
              return {
                ...l,
                priceKind: u.priceKind ?? l.priceKind,
                allowBackorder: u.allowBackorder ?? l.allowBackorder,
                gia:
                  u.gia != null && Number.isFinite(Number(u.gia))
                    ? Number(u.gia)
                    : l.gia,
                ton,
                qty,
                ten: u.ten || l.ten,
                anh: u.anh != null && u.anh !== "" ? u.anh : l.anh,
                path: u.path || l.path,
                dvt: u.dvt || l.dvt,
                trongLuong: u.trongLuong ?? l.trongLuong,
                attributes:
                  normalizeCartAttributes(u.attributes) || l.attributes,
              };
            })
            .filter((l) => l.qty > 0),
        }));
      },
      setQty: (ma, qty) => {
        set((s) => ({
          lines: s.lines
            .map((l) => {
              if (l.ma !== ma) return l;
              return { ...l, qty: clampQtyToStock(qty, l.ton, l.allowBackorder !== false) };
            })
            .filter((l) => l.qty > 0),
        }));
      },
      setLineNote: (ma, note) => {
        const cleaned = String(note || "").slice(0, 200);
        set((s) => ({
          lines: s.lines.map((l) =>
            l.ma === ma
              ? { ...l, lineNote: cleaned.trim() ? cleaned : undefined }
              : l
          ),
        }));
      },
      remove: (ma) => set((s) => ({ lines: s.lines.filter((l) => l.ma !== ma) })),
      clear: () => set({ lines: [] }),
      toggleSelected: (ma) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.ma === ma ? { ...l, selected: !l.selected } : l
          ),
        })),
      setAllSelected: (selected) =>
        set((s) => ({ lines: s.lines.map((l) => ({ ...l, selected })) })),
      removeSelected: () =>
        set((s) => ({ lines: s.lines.filter((l) => !l.selected) })),
      replaceLines: (lines) =>
        set({
          lines: lines
            .map((l) => ({
              ...l,
              dvt: l.dvt || "Cái",
              attributes: normalizeCartAttributes(l.attributes),
              lineNote: String(l.lineNote || "").trim().slice(0, 200) || undefined,
              qty: clampQtyToStock(l.qty, l.ton, l.allowBackorder !== false),
              selected: l.selected !== false,
              ctv: normalizeCtvCode(l.ctv || "") || undefined,
            }))
            .filter((l) => l.qty > 0),
        }),
      selectedCount: () =>
        get().lines.filter((l) => l.selected).reduce((n, l) => n + l.qty, 0),
      selectedTotal: () =>
        get()
          .lines.filter((l) => l.selected)
          .reduce((n, l) => n + l.gia * l.qty, 0),
      count: () => get().lines.reduce((n, l) => n + l.qty, 0),
      total: () => get().lines.reduce((n, l) => n + l.gia * l.qty, 0),
    }),
    {
      name: "aloha-shop-cart-v2",
      merge: (persisted, current) => {
        const p = persisted as Partial<CartState> | undefined;
        const lines = (p?.lines || [])
          .map((l) => ({
            ...l,
            dvt: l.dvt || "Cái",
            attributes: normalizeCartAttributes((l as CartLine).attributes),
            lineNote:
              String((l as CartLine).lineNote || "").trim().slice(0, 200) ||
              undefined,
            qty: clampQtyToStock(l.qty, l.ton, l.allowBackorder !== false),
            selected: l.selected !== false,
            ctv: normalizeCtvCode((l as CartLine).ctv || "") || undefined,
          }))
          .filter((l) => l.qty > 0);
        return { ...current, ...p, lines };
      },
    }
  )
);
