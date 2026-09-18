import type { Db } from "mongodb";
import {
  mergePackage,
  resolveDimensions,
  resolveLineWeightGram,
  type ProductShipMeta,
} from "./resolveWeight.js";
import type { CarrierQuoteInput } from "./ghtkClient.js";
import type { QuoteLineItem } from "./quoteToken.js";
import {
  loadCategoryMetaById,
  overlayProductCategoryFields,
} from "../shopCatalog/categoryMeta.js";

const COL = "aloha_products";

export type BuiltQuoteInput = {
  items: QuoteLineItem[];
  subtotal: number;
  totalWeightGram: number;
  package: CarrierQuoteInput;
};

function normalizeMa(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

function indexProductKeys(doc: Record<string, unknown>, byMa: Map<string, ProductShipMeta>) {
  const meta = doc as ProductShipMeta;
  for (const key of [doc.ma, doc.code, doc.id, doc.maHang, doc._id]) {
    const ma = normalizeMa(key);
    if (ma) byMa.set(ma, meta);
  }
}

async function loadProductsByCode(db: Db, mas: string[]): Promise<Map<string, ProductShipMeta>> {
  const byMa = new Map<string, ProductShipMeta>();
  if (!mas.length) return byMa;

  const docs = await db
    .collection(COL)
    .find({
      $or: [
        { ma: { $in: mas } },
        { code: { $in: mas } },
        { id: { $in: mas } },
        { maHang: { $in: mas } },
      ],
    })
    .project({
      ma: 1,
      code: 1,
      id: 1,
      maHang: 1,
      ten: 1,
      trongLuong: 1,
      shipSizeClass: 1,
      categoryId: 1,
      nhomPath: 1,
      nhom: 1,
      categoryName: 1,
      ancestor: 1,
      chieuDaiCm: 1,
      chieuRongCm: 1,
      chieuCaoCm: 1,
    })
    .toArray();

  const metaById = await loadCategoryMetaById(db);
  for (const d of docs) {
    indexProductKeys(
      overlayProductCategoryFields(d as Record<string, unknown>, metaById),
      byMa
    );
  }

  const missing = mas.filter((m) => !byMa.has(m));
  if (missing.length) {
    const rx = missing.map((m) => new RegExp(`^${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
    const loose = await db
      .collection(COL)
      .find({ $or: [{ ma: { $in: rx } }, { code: { $in: rx } }] })
      .project({
        ma: 1,
        code: 1,
        id: 1,
        maHang: 1,
        ten: 1,
        trongLuong: 1,
        shipSizeClass: 1,
        categoryId: 1,
        nhomPath: 1,
        nhom: 1,
        categoryName: 1,
        ancestor: 1,
        chieuDaiCm: 1,
        chieuRongCm: 1,
        chieuCaoCm: 1,
      })
      .limit(50)
      .toArray();
    for (const d of loose) {
      indexProductKeys(
        overlayProductCategoryFields(d as Record<string, unknown>, metaById),
        byMa
      );
    }
  }

  return byMa;
}

export async function buildCarrierQuoteInput(
  db: Db,
  items: QuoteLineItem[],
  address: {
    province: string;
    district?: string;
    ward: string;
    ghnDistrictId?: number;
    ghnWardCode?: string;
  }
): Promise<BuiltQuoteInput> {
  const lines = items
    .map((it) => ({
      productCode: normalizeMa(it.productCode),
      productName: String(it.productName || "").trim(),
      trongLuong: Math.max(0, Number(it.trongLuong) || 0),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      price: Math.max(0, Number(it.price) || 0),
    }))
    .filter((it) => it.productCode);

  if (!lines.length) throw new Error("Giỏ hàng trống");

  const mas = [...new Set(lines.map((l) => l.productCode))];
  const byMa = await loadProductsByCode(db, mas);

  const pkgLines: {
    weightGram: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    quantity?: number;
  }[] = [];
  let subtotal = 0;

  for (const ln of lines) {
    const found = byMa.get(ln.productCode);
    // Chỉ tin cân trên catalog; thiếu → preset server (không tin client).
    const doc: ProductShipMeta = found
      ? {
          ...found,
          ten: found.ten || ln.productName,
          trongLuong:
            Number(found.trongLuong) > 0 ? found.trongLuong : undefined,
        }
      : {
          ma: ln.productCode,
          ten: ln.productName,
          trongLuong: undefined,
        };
    const dim = resolveDimensions(doc);
    const lineWeight = resolveLineWeightGram(doc, ln.quantity);
    pkgLines.push({
      weightGram: lineWeight,
      lengthCm: dim.lengthCm,
      widthCm: dim.widthCm,
      heightCm: dim.heightCm,
      quantity: ln.quantity,
    });
    subtotal += ln.price * ln.quantity;
  }

  const merged = mergePackage(pkgLines);
  const packageInput: CarrierQuoteInput = {
    weightGram: merged.weightGram,
    lengthCm: merged.lengthCm,
    widthCm: merged.widthCm,
    heightCm: merged.heightCm,
    province: String(address.province || "").trim(),
    district: String(address.district || "").trim(),
    ward: String(address.ward || "").trim(),
    ghnDistrictId: address.ghnDistrictId,
    ghnWardCode: address.ghnWardCode,
    valueVnd: subtotal,
  };

  return {
    items: lines.map(({ productCode, productName, trongLuong, quantity, price }) => ({
      productCode,
      productName,
      trongLuong,
      quantity,
      price,
    })),
    subtotal,
    totalWeightGram: merged.weightGram,
    package: packageInput,
  };
}
