import { attachEta } from "./etaService.js";
import type {
  CarrierQuoteInput,
  CarrierQuoteResult,
  ShipmentOrderInput,
  ShipmentOrderResult,
} from "./carrierTypes.js";

const PICK_PROVINCE = () =>
  String(process.env.GHTK_PICK_PROVINCE || "Hồ Chí Minh").trim();

function isMetroProvince(province: string): boolean {
  return /hà nội|ha noi|hồ chí minh|ho chi minh|đà nẵng|da nang|cần thơ|can tho/i.test(
    province
  );
}

function estimateFee(pkg: CarrierQuoteInput): number {
  const kg = Math.max(0.5, pkg.weightGram / 1000);
  const base = 18000;
  const perKg = 6000;
  const pick = PICK_PROVINCE();
  const sameCity =
    normProvinceKey(pkg.province) === normProvinceKey(pick) ||
    (/hồ chí minh|ho chi minh/i.test(pkg.province) &&
      /hồ chí minh|ho chi minh/i.test(pick));
  const remote = sameCity ? 0 : isMetroProvince(pkg.province) ? 5000 : 12000;
  const bulky = pkg.lengthCm * pkg.widthCm * pkg.heightCm > 25 * 25 * 35 ? 12000 : 0;
  const fee = Math.round(base + kg * perKg + remote + bulky);
  return Math.max(15000, fee);
}

function normProvinceKey(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?)\s+/i, "")
    .trim();
}

function ghtkHeaders(token: string): Record<string, string> {
  const partner = String(process.env.GHTK_PARTNER_CODE || "").trim();
  const h: Record<string, string> = {
    Token: token,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (partner) h["X-Client-Source"] = partner;
  return h;
}

function ghtkWeightGram(pkg: CarrierQuoteInput): number {
  return Math.max(100, Math.round(pkg.weightGram));
}

function baseResult(
  pkg: CarrierQuoteInput,
  fee: number,
  source: "api" | "estimate",
  raw?: unknown
): CarrierQuoteResult {
  return attachEta(
    {
      carrier: "ghtk",
      name: "Giao Hàng Tiết Kiệm",
      fee: Math.round(fee),
      source,
      raw,
    },
    pkg.province,
    "standard"
  );
}

export async function quoteGhtk(pkg: CarrierQuoteInput): Promise<CarrierQuoteResult | null> {
  const token = String(process.env.GHTK_API_TOKEN || "").trim();
  const pickProvince = PICK_PROVINCE();
  const pickDistrict = String(process.env.GHTK_PICK_DISTRICT || "").trim();
  const pickWard = String(process.env.GHTK_PICK_WARD || "").trim();
  const weightGram = ghtkWeightGram(pkg);

  if (!token) {
    return baseResult(pkg, estimateFee(pkg) - 1000, "estimate");
  }

  const feePayload = {
    pick_province: pickProvince,
    pick_district: pickDistrict || undefined,
    pick_ward: pickWard || undefined,
    province: pkg.province,
    district: pkg.district || pkg.ward,
    ward: pkg.ward,
    weight: weightGram,
    length: pkg.lengthCm,
    width: pkg.widthCm,
    height: pkg.heightCm,
    value: pkg.valueVnd,
  };

  try {
    const res = await fetch("https://services.giaohangtietkiem.vn/services/shipment/fee", {
      method: "POST",
      headers: ghtkHeaders(token),
      body: JSON.stringify(feePayload),
      signal: AbortSignal.timeout(25_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      fee?: { fee?: number; delivery?: number };
      message?: string;
    };
    const fee = Number(json?.fee?.fee ?? json?.fee?.delivery ?? 0);
    if (!res.ok || !json.success || fee <= 0) {
      throw new Error(json?.message || "GHTK fee failed");
    }
    return baseResult(pkg, fee, "api", json);
  } catch (e) {
    console.warn("[shopShipping] quoteGhtk POST:", e);
    try {
      const qs = new URLSearchParams({
        pick_province: pickProvince,
        pick_district: pickDistrict,
        province: pkg.province,
        district: pkg.district || pkg.ward,
        weight: String(weightGram),
        value: String(Math.max(0, Math.round(pkg.valueVnd))),
      });
      if (pickWard) qs.set("pick_ward", pickWard);
      if (pkg.ward) qs.set("ward", pkg.ward);
      const res = await fetch(
        `https://services.giaohangtietkiem.vn/services/shipment/fee?${qs}`,
        {
          method: "GET",
          headers: ghtkHeaders(token),
          signal: AbortSignal.timeout(25_000),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        fee?: { fee?: number; delivery?: number };
        message?: string;
      };
      const fee = Number(json?.fee?.fee ?? json?.fee?.delivery ?? 0);
      if (res.ok && json.success && fee > 0) {
        return baseResult(pkg, fee, "api", json);
      }
    } catch (e2) {
      console.warn("[shopShipping] quoteGhtk GET:", e2);
    }
    return baseResult(pkg, estimateFee(pkg) - 1000, "estimate");
  }
}

export async function createGhtkOrder(input: ShipmentOrderInput): Promise<ShipmentOrderResult> {
  const token = String(process.env.GHTK_API_TOKEN || "").trim();
  if (!token) return { ok: false, error: "Chưa cấu hình GHTK_API_TOKEN" };

  const pickProvince = PICK_PROVINCE();
  const pickDistrict = String(process.env.GHTK_PICK_DISTRICT || "").trim();
  const pickWard = String(process.env.GHTK_PICK_WARD || "").trim();
  const pickName = String(process.env.GHTK_PICK_NAME || "ALOHA THẾ GIỚI CHẬU CÂY").trim();
  const pickPhone = String(process.env.GHTK_PICK_PHONE || "").trim();

  const body = {
    products: [{ name: `Đơn ${input.orderCode}`, weight: ghtkWeightGram(input), quantity: 1 }],
    order: {
      id: input.orderCode,
      pick_name: pickName,
      pick_address: pickWard,
      pick_province: pickProvince,
      pick_district: pickDistrict,
      pick_ward: pickWard,
      pick_tel: pickPhone,
      name: input.customerName,
      address: input.address,
      province: input.province,
      district: input.district || input.ward,
      ward: input.ward,
      hamlet: "Khác",
      tel: input.customerPhone,
      is_freeship: (input.codAmount || 0) <= 0 ? 1 : 0,
      pick_money: Math.max(0, Math.round(input.codAmount || 0)),
      value: Math.max(0, Math.round(input.valueVnd)),
      transport: "road",
      weight_option: "gram",
      total_weight: ghtkWeightGram(input),
    },
  };

  try {
    const res = await fetch("https://services.giaohangtietkiem.vn/services/shipment/order", {
      method: "POST",
      headers: ghtkHeaders(token),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      order?: { label?: string; tracking_id?: number; partner_id?: string };
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json?.message || "GHTK tạo đơn thất bại", raw: json };
    }
    return {
      ok: true,
      trackingCode: String(json.order?.label || json.order?.partner_id || ""),
      carrierOrderId: String(json.order?.tracking_id || ""),
      labelUrl: json.order?.label ? `https://services.giaohangtietkiem.vn/services/label/${json.order.label}` : undefined,
      raw: json,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "GHTK tạo đơn lỗi" };
  }
}

export type { CarrierQuoteInput, CarrierQuoteResult } from "./carrierTypes.js";
