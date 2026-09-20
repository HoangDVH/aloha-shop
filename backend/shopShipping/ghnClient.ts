import { resolveGhnLocation } from "./locationCache.js";
import { attachEta } from "./etaService.js";
import type {
  CarrierQuoteInput,
  CarrierQuoteResult,
  ShipmentOrderInput,
  ShipmentOrderResult,
} from "./carrierTypes.js";

function estimateFee(pkg: CarrierQuoteInput): number {
  const kg = Math.max(0.5, pkg.weightGram / 1000);
  const base = 19000;
  const perKg = 5500;
  const pick = String(process.env.GHTK_PICK_PROVINCE || "Hồ Chí Minh").trim();
  const sameCity =
    normProvinceKey(pkg.province) === normProvinceKey(pick) ||
    (/hồ chí minh|ho chi minh/i.test(pkg.province) &&
      /hồ chí minh|ho chi minh/i.test(pick));
  const remote = sameCity
    ? 0
    : /hà nội|ha noi|hồ chí minh|ho chi minh|đà nẵng|da nang|cần thơ|can tho/i.test(
          pkg.province
        )
      ? 5000
      : 12000;
  const bulky = pkg.lengthCm * pkg.widthCm * pkg.heightCm > 25 * 25 * 35 ? 10000 : 0;
  return Math.max(15000, Math.round(base + kg * perKg + remote + bulky));
}

function normProvinceKey(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?)\s+/i, "")
    .trim();
}

function baseResult(
  pkg: CarrierQuoteInput,
  fee: number,
  source: "api" | "estimate",
  raw?: unknown
): CarrierQuoteResult {
  return attachEta(
    {
      carrier: "ghn",
      name: "Giao Hàng Nhanh",
      fee: Math.round(fee),
      source,
      raw,
    },
    pkg.province,
    "express"
  );
}

export async function quoteGhn(pkg: CarrierQuoteInput): Promise<CarrierQuoteResult | null> {
  const token = String(process.env.GHN_TOKEN || "").trim();
  const shopId = Number(process.env.GHN_SHOP_ID || 0);
  const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID || 0);

  if (!token || !shopId || !fromDistrictId) {
    return baseResult(pkg, estimateFee(pkg), "estimate");
  }

  try {
    const loc = await resolveGhnLocation(pkg.province, pkg.district || "", pkg.ward, {
      districtId: pkg.ghnDistrictId,
      wardCode: pkg.ghnWardCode,
    });
    if (!loc) throw new Error("Không map được địa chỉ GHN");

    const body = {
      shop_id: shopId,
      from_district_id: fromDistrictId,
      to_district_id: loc.districtId,
      to_ward_code: loc.wardCode,
      weight: Math.max(100, Math.round(pkg.weightGram)),
      length: Math.max(1, Math.round(pkg.lengthCm)),
      width: Math.max(1, Math.round(pkg.widthCm)),
      height: Math.max(1, Math.round(pkg.heightCm)),
      insurance_value: Math.max(0, Math.round(pkg.valueVnd)),
      coupon: null,
    };

    const res = await fetch(
      "https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee",
      {
        method: "POST",
        headers: {
          Token: token,
          ShopId: String(shopId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      data?: { total?: number; service_fee?: number };
    };
    const fee = Number(json?.data?.total ?? json?.data?.service_fee ?? 0);
    if (!res.ok || json.code !== 200 || fee <= 0) {
      throw new Error(json?.message || "GHN fee failed");
    }
    return baseResult(pkg, fee, "api", json);
  } catch (e) {
    console.warn("[shopShipping] quoteGhn:", e);
    return baseResult(pkg, estimateFee(pkg), "estimate");
  }
}

export async function createGhnOrder(input: ShipmentOrderInput): Promise<ShipmentOrderResult> {
  const token = String(process.env.GHN_TOKEN || "").trim();
  const shopId = Number(process.env.GHN_SHOP_ID || 0);
  const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID || 0);
  if (!token || !shopId || !fromDistrictId) {
    return { ok: false, error: "Chưa cấu hình GHN_TOKEN/SHOP_ID/FROM_DISTRICT" };
  }

  try {
    const loc = await resolveGhnLocation(input.province, input.district || "", input.ward, {
      districtId: input.ghnDistrictId,
      wardCode: input.ghnWardCode,
    });
    if (!loc) return { ok: false, error: "Không map được địa chỉ GHN" };

    const body = {
      payment_type_id: (input.codAmount || 0) > 0 ? 2 : 1,
      note: input.note || `Đơn web ${input.orderCode}`,
      required_note: "CHOXEMHANGKHONGTHU",
      from_name: String(process.env.GHN_FROM_NAME || "ALOHA THẾ GIỚI CHẬU CÂY"),
      from_phone: String(process.env.GHN_FROM_PHONE || ""),
      from_address: String(process.env.GHN_FROM_ADDRESS || "Tân Bình, HCM"),
      from_ward_name: String(process.env.GHTK_PICK_WARD || ""),
      from_district_name: String(process.env.GHTK_PICK_DISTRICT || ""),
      from_province_name: String(process.env.GHTK_PICK_PROVINCE || "Hồ Chí Minh"),
      to_name: input.customerName,
      to_phone: input.customerPhone,
      to_address: input.address,
      to_ward_code: loc.wardCode,
      to_district_id: loc.districtId,
      cod_amount: Math.max(0, Math.round(input.codAmount || 0)),
      content: `Đơn ${input.orderCode}`,
      weight: Math.max(100, Math.round(input.weightGram)),
      length: Math.max(1, Math.round(input.lengthCm)),
      width: Math.max(1, Math.round(input.widthCm)),
      height: Math.max(1, Math.round(input.heightCm)),
      insurance_value: Math.max(0, Math.round(input.valueVnd)),
      service_type_id: 2,
      client_order_code: input.orderCode,
    };

    const res = await fetch(
      "https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create",
      {
        method: "POST",
        headers: {
          Token: token,
          ShopId: String(shopId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      data?: { order_code?: string; sort_code?: string };
    };
    if (!res.ok || json.code !== 200) {
      return { ok: false, error: json?.message || "GHN tạo đơn thất bại", raw: json };
    }
    return {
      ok: true,
      trackingCode: String(json.data?.order_code || ""),
      carrierOrderId: String(json.data?.sort_code || json.data?.order_code || ""),
      raw: json,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "GHN tạo đơn lỗi" };
  }
}
