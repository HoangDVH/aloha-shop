/**
 * Dựng danh sách Combo / Quy đổi từ SP đã có trong kho (Mongo / HangHoa).
 * Khớp lọc Loại hàng: type 1 = Combo; có masterUnitId + hệ số > 1 = Quy đổi.
 */
import { LOAI_QUY_DOI, type Combo } from "../services/database";
import { sortByNewest } from "./productCreatedAt";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function maOf(p: any): string {
  return String(p?.ma || p?.code || "")
    .trim()
    .toUpperCase();
}

function resolveKvId(p: any): number {
  const id = num(p?.kvId ?? p?.kiotVietId ?? (typeof p?.id === "number" ? p.id : 0));
  return id > 0 ? id : 0;
}

function thanhPhanFromProduct(p: any): string[] {
  if (Array.isArray(p?.thanhPhan) && p.thanhPhan.length) {
    return p.thanhPhan.map((x: unknown) => String(x || "").trim()).filter(Boolean);
  }
  if (Array.isArray(p?.hangThanhPhan) && p.hangThanhPhan.length) {
    return p.hangThanhPhan
      .map((tp: any) => {
        const code = String(tp?.ma || tp?.maHang || tp?.code || "").trim();
        if (!code) return "";
        const qty = num(tp.soLuong ?? tp.qty ?? tp.quantity) || 1;
        return qty !== 1 ? `${code} × ${qty}` : code;
      })
      .filter(Boolean);
  }
  const formulas = p?.productFormulas || p?.ProductFormulas || [];
  if (!Array.isArray(formulas) || !formulas.length) return [];
  const out: string[] = [];
  for (const f of formulas) {
    const nested = f?.product || f?.Product || {};
    const code = String(
      f?.materialCode || f?.MaterialCode || nested?.code || nested?.Code || f?.code || ""
    ).trim();
    if (!code) continue;
    const qty = num(f?.quantity ?? f?.Quantity) || 1;
    out.push(qty !== 1 ? `${code} × ${qty}` : code);
  }
  return out;
}

function isComboProduct(p: any): boolean {
  const t = num(p?.productType ?? p?.type);
  if (t === 1) return true;
  const loai = String(p?.loai || p?.loaiHang || p?.loai_hang || "").toLowerCase();
  return loai.includes("combo");
}

function isQuyDoiProduct(p: any): boolean {
  const heSo = num(p?.conversionValue);
  const masterId = num(p?.masterUnitId ?? p?.masterProductId);
  return masterId > 0 && heSo > 1;
}

/**
 * @param products — danh sách SP (có thể gồm cả combo lẫn hàng thường để tra mã gốc quy đổi)
 */
export function buildCombosFromProducts(products: any[]): Combo[] {
  const list = Array.isArray(products) ? products : [];
  const byKvId = new Map<number, any>();
  for (const p of list) {
    const id = resolveKvId(p);
    if (id) byKvId.set(id, p);
  }

  const out: Combo[] = [];
  let stt = 1;
  const seen = new Set<string>();

  for (const p of list) {
    if (p?.isActive === false) continue;
    const ma = maOf(p);
    if (!ma || seen.has(ma)) continue;

    if (isComboProduct(p)) {
      const thanhPhan = thanhPhanFromProduct(p);
      out.push({
        stt: stt++,
        ma,
        ten: String(p.ten || p.name || ma),
        loai: "Combo - đóng gói",
        dvt: String(p.dvt || p.unit || "BỘ"),
        giaVon: String(Math.round(num(p.giaVon ?? p.cost))),
        giaBan: String(Math.round(num(p.giaBan ?? p.basePrice))),
        maTp: thanhPhan.join(" | "),
        thanhPhan,
        productFormulas: Array.isArray(p.productFormulas)
          ? p.productFormulas
          : Array.isArray(p.ProductFormulas)
            ? p.ProductFormulas
            : undefined,
        hangThanhPhan: Array.isArray(p.hangThanhPhan) ? p.hangThanhPhan : undefined,
        anh: typeof p.anh === "string" ? p.anh : undefined,
        images: Array.isArray(p.images) ? p.images : undefined,
        createdDate: p.createdDate || p.CreatedDate || p.taoLuc || undefined,
        createdAt: p.createdAt || undefined,
        kvId: num(p.kvId ?? p.kiotVietId) || undefined,
      });
      seen.add(ma);
      continue;
    }

    if (!isQuyDoiProduct(p)) continue;
    const heSo = num(p.conversionValue);
    const masterId = num(p.masterUnitId ?? p.masterProductId);
    let maGoc = String(p.masterCode || "")
      .trim()
      .toUpperCase();
    if (!maGoc && masterId) {
      const base = byKvId.get(masterId);
      maGoc = maOf(base);
    }
    // Không bỏ dòng quy đổi khi thiếu mã gốc trên cùng trang (master nằm ngoài pageSize)
    if (!maGoc) maGoc = masterId > 0 ? `#${masterId}` : "—";
    if (maGoc === ma) continue;

    const giaLon = num(p.giaVon ?? p.cost);
    const giaLe = heSo > 0 ? Math.round(giaLon / heSo) : 0;
    const dvtLon = String(p.dvt || p.unit || "Thùng");
    out.push({
      stt: stt++,
      ma,
      ten: String(p.ten || p.name || ma),
      loai: LOAI_QUY_DOI,
      dvt: dvtLon,
      giaVon: giaLon ? giaLon.toLocaleString("vi-VN") : "0",
      giaBan: String(Math.round(num(p.giaBan ?? p.basePrice))),
      maTp: `${maGoc} (×${heSo})`,
      thanhPhan: [
        `${maGoc} GV:${giaLe.toLocaleString("vi-VN")}đ`,
        `1 ${dvtLon} = ${heSo} đơn vị cơ bản`,
        "Nguồn: kho hàng hóa",
      ],
      anh: typeof p.anh === "string" ? p.anh : undefined,
      images: Array.isArray(p.images) ? p.images : undefined,
      createdDate: p.createdDate || p.CreatedDate || p.taoLuc || undefined,
      createdAt: p.createdAt || undefined,
      kvId: num(p.kvId ?? p.kiotVietId) || undefined,
    });
    seen.add(ma);
  }

  return out;
}

export function sortCombosNewestFirst(list: Combo[]): Combo[] {
  return sortByNewest(list);
}

/** Giữ bản ghi tự tạo (không có trên kho SP) khi đồng bộ lại. */
export function mergeLocalOnlyCombos(fromProducts: Combo[], local: Combo[]): Combo[] {
  const fromSet = new Set(fromProducts.map((c) => c.ma.toUpperCase()));
  const kept = (local || []).filter((c) => {
    const ma = String(c.ma || "")
      .trim()
      .toUpperCase();
    if (!ma || fromSet.has(ma)) return false;
    // Không giữ bản quy đổi / combo KV cũ lệch kho
    if (c.loai === LOAI_QUY_DOI) return false;
    if (String(c.loai || "").toLowerCase().includes("combo - đóng")) return false;
    return true;
  });
  const merged = sortCombosNewestFirst([...fromProducts, ...kept]);
  merged.forEach((c, i) => {
    c.stt = i + 1;
  });
  return merged;
}
