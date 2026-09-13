/**
 * Giá trị mã vạch ổn định từ Product Aloha.
 * Ưu tiên barcode KiotViet; trống thì dùng mã SP (ma). Không random.
 */
import type { Product } from "../services/database";
import { db as localDb } from "../services/database";
import { upsertAlohaProduct } from "../services/alohaApi";

export type BarcodeFormat = "CODE128" | "EAN13";

/** EAN-13: đúng 13 số + checksum hợp lệ */
export function isValidEan13(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(s[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(s[12]);
}

/** Chuỗi in lên tem / quét máy — ổn định theo SP */
export function resolveBarcodeValue(p: {
  barcode?: string;
  ma?: string;
}): string {
  const fromKv = String(p.barcode || "").trim();
  if (fromKv) return fromKv;
  return String(p.ma || "").trim();
}

export function pickBarcodeFormat(value: string): BarcodeFormat {
  return isValidEan13(value) ? "EAN13" : "CODE128";
}

/** SP chưa có barcode trong kho → cần ghi = ma rồi đẩy KV */
export function needsBarcodeFill(p: {
  barcode?: string;
  ma?: string;
}): boolean {
  return !String(p.barcode || "").trim() && !!String(p.ma || "").trim();
}

function readKvAuth(): { token: string; retailer: string } | null {
  try {
    const token =
      localStorage.getItem("aloha_kv_access_token") ||
      localStorage.getItem("aloha_kiotviet_token") ||
      "";
    let retailer = localStorage.getItem("aloha_kv_retailer") || "";
    if (!retailer) {
      const cfg = JSON.parse(
        localStorage.getItem("aloha_kiotviet_config") || "null",
      );
      retailer = String(cfg?.retailer || "").trim();
    }
    if (!token || !retailer) return null;
    return { token, retailer };
  } catch {
    return null;
  }
}

async function pushBarcodeToKiotViet(
  ma: string,
  barcode: string,
  auth: { token: string; retailer: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const getRes = await fetch(
      `/kv-api/products/code/${encodeURIComponent(ma)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          Retailer: auth.retailer,
          "Content-Type": "application/json",
        },
      },
    );
    if (!getRes.ok) {
      const t = await getRes.text().catch(() => "");
      return { ok: false, error: `GET ${getRes.status} ${t.slice(0, 80)}` };
    }
    const p = await getRes.json();
    if (!p?.id) return { ok: false, error: "KV không trả id SP" };

    const existing = String(p.barCode || p.barcode || "").trim();
    if (existing) {
      // Đã có trên KV — không ghi đè
      return { ok: true };
    }

    const body: Record<string, unknown> = {
      id: p.id,
      code: p.code,
      name: p.name,
      categoryId: p.categoryId,
      basePrice: p.basePrice,
      allowsSale: p.allowsSale !== undefined ? p.allowsSale : true,
      isActive: p.isActive !== undefined ? p.isActive : true,
      unit: p.unit || "Cái",
      barCode: barcode,
    };

    const putRes = await fetch(`/kv-api/products/${p.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Retailer: auth.retailer,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      const t = await putRes.text().catch(() => "");
      return { ok: false, error: `PUT ${putRes.status} ${t.slice(0, 120)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export type EnsureBarcodeResult = {
  /** SP đã gắn barcode (kể cả đã có sẵn) */
  products: Product[];
  filledCount: number;
  mongoOk: boolean;
  kvOk: number;
  kvFail: { ma: string; error: string }[];
  kvSkippedNoAuth: boolean;
};

/**
 * Với SP thiếu barcode: gán = ma, lưu Mongo VPS + (nếu có token) đẩy lên KiotViet.
 * Không gọi API theo từng tem — chỉ 1 lần / mã SP.
 */
export async function ensureProductBarcodes(
  products: Product[],
  opts?: {
    setProducts?: (next: Product[] | ((prev: Product[]) => Product[])) => void;
    onProgress?: (msg: string) => void;
  },
): Promise<EnsureBarcodeResult> {
  const list = Array.isArray(products) ? products : [];
  const byMa = new Map<string, Product>();
  list.forEach((p) => {
    const ma = String(p?.ma || "").trim();
    if (!ma) return;
    const key = ma.toUpperCase();
    if (!byMa.has(key)) byMa.set(key, p);
  });

  const toFill: Product[] = [];
  byMa.forEach((p) => {
    if (needsBarcodeFill(p)) toFill.push(p);
  });

  const auth = readKvAuth();
  const kvFail: { ma: string; error: string }[] = [];
  let kvOk = 0;
  let mongoOk = true;
  const patched: Product[] = [];

  if (toFill.length === 0) {
    return {
      products: list.map((p) => ({
        ...p,
        barcode: resolveBarcodeValue(p) || p.barcode,
      })),
      filledCount: 0,
      mongoOk: true,
      kvOk: 0,
      kvFail: [],
      kvSkippedNoAuth: false,
    };
  }

  opts?.onProgress?.(
    `Đang lưu mã vạch cho ${toFill.length} SP (Mongo + KiotViet)…`,
  );

  for (const p of toFill) {
    const barcode = String(p.ma || "").trim();
    const next: Product = { ...p, barcode };
    patched.push(next);

    localDb.saveProductOverride(p.ma, { barcode });

    try {
      await upsertAlohaProduct({
        ma: p.ma,
        code: p.ma,
        ten: p.ten,
        name: p.ten,
        barcode,
        barCode: barcode,
        dvt: p.dvt,
        giaBan: p.giaBan,
        giaVon: p.giaVon,
      });
    } catch {
      /* tiếp tục — vẫn patch kho KV */
    }

    if (auth) {
      const r = await pushBarcodeToKiotViet(p.ma, barcode, auth);
      if (r.ok) kvOk++;
      else kvFail.push({ ma: p.ma, error: r.error || "lỗi" });
    }
  }

  const patchRes = await localDb.patchProductsKvToMongo(patched);
  mongoOk = !!patchRes.mongoOk;

  const patchMap = new Map(
    patched.map((p) => [String(p.ma).trim().toUpperCase(), p.barcode || ""]),
  );

  if (opts?.setProducts) {
    opts.setProducts((prev) =>
      prev.map((p) => {
        const hit = patchMap.get(
          String(p.ma || "")
            .trim()
            .toUpperCase(),
        );
        return hit != null && hit !== "" ? { ...p, barcode: hit } : p;
      }),
    );
  }

  const out = list.map((p) => {
    const hit = patchMap.get(
      String(p.ma || "")
        .trim()
        .toUpperCase(),
    );
    if (hit) return { ...p, barcode: hit };
    return { ...p, barcode: resolveBarcodeValue(p) || p.barcode };
  });

  return {
    products: out,
    filledCount: patched.length,
    mongoOk,
    kvOk,
    kvFail,
    kvSkippedNoAuth: !auth,
  };
}
