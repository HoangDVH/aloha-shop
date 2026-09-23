import { isActiveWholesale, wholesaleMinimum } from "../shopWholesale/policy.js";
import type { Response } from "express";
import type { Db } from "mongodb";
import type { ShopOrderDetail } from "./models.js";
import {
  applyPriceBookOverlay,
  loadPriceBooksByMa,
  publicPrice,
  resolveShopPrice,
} from "../shopCatalog/priceOverlay.js";
import { applyShopCors } from "../shopCors.js";
import { isShopTestBuyerEmail } from "./checkoutFlags.js";

/** Helper dùng chung route đơn shop (tạo đơn / me / thanh toán). */

export function fullAddressForKv(doc: {
  deliveryMethod?: string;
  shippingAddress?: string;
  ward?: string;
  district?: string;
  province?: string;
}): string {
  if (doc.deliveryMethod === "nhan_cua_hang") return "Nhận tại cửa hàng ALOHA";
  return [doc.shippingAddress, doc.ward, doc.district, doc.province]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

export type GetMainDb = () => Promise<Db>;

export function setShopCors(req: { headers: { origin?: string } }, res: Response) {
  applyShopCors(req, res);
}

function normalizeCtv(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

export function parseOrderDetails(raw: unknown): ShopOrderDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any) => {
      const productCode = String(it?.productCode || it?.ma || "")
        .trim()
        .toUpperCase();
      const quantity = Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1));
      const price = Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0);
      const ctv = normalizeCtv(it?.ctvCode || it?.ctv);
      const variantLabel = String(it?.variantLabel || "").trim().slice(0, 120);
      const note = it?.note ? String(it.note).slice(0, 200) : undefined;
      return {
        productCode,
        productName: String(it?.productName || it?.ten || productCode).trim(),
        quantity,
        price,
        discount: Number(it?.discount || 0) || 0,
        note: note || undefined,
        variantLabel: variantLabel || undefined,
        imageUrl: it?.imageUrl || it?.anh ? String(it.imageUrl || it.anh) : undefined,
        ctvCode: ctv.length >= 3 ? ctv : undefined,
      };
    })
    .filter((d) => d.productCode);
}

/** Ghi đè giá/tên theo catalog. Reject nếu thiếu SP hoặc giá public <= 0 (trừ test buyer). */
export async function applyCatalogPrices(
  mainDb: Db,
  details: ShopOrderDetail[],
  opts?: { buyerEmail?: string | null; account?: Record<string, unknown> | null; quoteOnly?: boolean }
): Promise<
  | { ok: true; details: ShopOrderDetail[] }
  | { ok: false; error: string }
> {
  const allowZeroPrice = isShopTestBuyerEmail(opts?.buyerEmail);
  const mas = [...new Set(details.map((d) => d.productCode).filter(Boolean))];
  if (!mas.length) return { ok: false, error: "Giỏ hàng trống hoặc thiếu sản phẩm" };
  const docs = await mainDb
    .collection("aloha_products")
    .find({
      deletedAt: null,
      $or: [
        { ma: { $in: mas } },
        { ma: { $in: mas.map((m) => m.toLowerCase()) } },
      ],
    })
    .project({
      ma: 1,
      ten: 1,
      giaWeb: 1, giaSi: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      anh: 1,
      priceBooks: 1,
    })
    .toArray();
  const byMa = new Map<string, any>();
  for (const d of docs) {
    const key = String(d.ma || "").trim().toUpperCase();
    if (key) byMa.set(key, d);
  }
  const pbByMa = await loadPriceBooksByMa(mainDb, mas);
  const out: ShopOrderDetail[] = [];
  for (const d of details) {
    const raw = byMa.get(d.productCode);
    if (!raw) {
      return { ok: false, error: `Không tìm thấy sản phẩm ${d.productCode}` };
    }
    const doc = applyPriceBookOverlay(raw, pbByMa.get(d.productCode));
    const { gia, priceKind } = resolveShopPrice(doc, isActiveWholesale(opts?.account) ? "si" : "web");
    if (priceKind === "si_missing" && !opts?.quoteOnly) return { ok: false, error: `${d.productCode} chưa có giá sỉ — vui lòng liên hệ báo giá` };
    if (!(gia > 0) && !allowZeroPrice && !opts?.quoteOnly) {
      return {
        ok: false,
        error: `${d.productCode} chưa có giá bán web — không thể đặt hàng`,
      };
    }
    const baseName = String(doc.ten || d.productName).trim() || d.productName;
    const variant = String(d.variantLabel || "").trim();
    out.push({
      ...d,
      productName:
        variant && !baseName.includes(variant)
          ? `${baseName} (${variant})`
          : baseName,
      price: gia,
      priceKind,
      discount: 0,
      imageUrl: d.imageUrl || (doc.anh ? String(doc.anh) : undefined),
      note: d.note ? String(d.note).slice(0, 200) : undefined,
      variantLabel: variant || undefined,
    });
  }
  if (isActiveWholesale(opts?.account)) {
    if (!["HCM", "TINH"].includes(String(opts?.account?.siRegion))) return { ok: false, error: "Tài khoản sỉ cần được xác nhận khu vực" };
    const minimum = wholesaleMinimum(opts?.account?.siRegion);
    const total = out.reduce((n, d) => n + d.price * d.quantity, 0);
    if (total < minimum && !opts?.quoteOnly) return { ok: false, error: `Đơn sỉ tỉnh cần thêm ${(minimum-total).toLocaleString("vi-VN")}đ tiền hàng để đủ ${minimum.toLocaleString("vi-VN")}đ` };
  }
  return { ok: true, details: out };
}

/** Bổ sung ảnh SP cho đơn cũ thiếu imageUrl. */
export async function enrichOrderDetailsImages(
  mainDb: Db,
  details: ShopOrderDetail[]
): Promise<ShopOrderDetail[]> {
  if (!details.length) return details;
  const need = details.filter((d) => !String(d.imageUrl || "").trim());
  if (!need.length) return details;
  const mas = [...new Set(need.map((d) => d.productCode).filter(Boolean))];
  const docs = await mainDb
    .collection("aloha_products")
    .find({
      deletedAt: null,
      $or: [
        { ma: { $in: mas } },
        { ma: { $in: mas.map((m) => m.toLowerCase()) } },
      ],
    })
    .project({ ma: 1, anh: 1, images: 1 })
    .toArray();
  const anhByMa = new Map<string, string>();
  for (const p of docs) {
    const ma = String((p as any).ma || "").trim().toUpperCase();
    const anh =
      String((p as any).anh || "").trim() ||
      String((Array.isArray((p as any).images) && (p as any).images[0]) || "").trim();
    if (ma && anh) anhByMa.set(ma, anh);
  }
  return details.map((d) => {
    if (String(d.imageUrl || "").trim()) return d;
    const anh = anhByMa.get(d.productCode);
    return anh ? { ...d, imageUrl: anh } : d;
  });
}
