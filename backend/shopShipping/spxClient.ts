import { attachEta } from "./etaService.js";
import type {
  CarrierQuoteInput,
  CarrierQuoteResult,
  ShipmentOrderInput,
  ShipmentOrderResult,
} from "./carrierTypes.js";

function spxEnabled(): boolean {
  const flag = String(process.env.SPX_ENABLED ?? "1").trim();
  return flag !== "0" && flag.toLowerCase() !== "false";
}

function estimateFee(pkg: CarrierQuoteInput): number {
  const kg = Math.max(0.5, pkg.weightGram / 1000);
  const base = 18500;
  const perKg = 5800;
  const sameCity = /hồ chí minh|ho chi minh/i.test(pkg.province);
  const remote = sameCity
    ? 0
    : /hà nội|ha noi|đà nẵng|da nang|cần thơ|can tho/i.test(pkg.province)
      ? 4500
      : 11000;
  return Math.max(15000, Math.round(base + kg * perKg + remote));
}

function baseResult(
  pkg: CarrierQuoteInput,
  fee: number,
  source: "api" | "estimate",
  raw?: unknown
): CarrierQuoteResult {
  return attachEta(
    {
      carrier: "spx",
      name: "SPX Express",
      fee: Math.round(fee),
      source,
      raw,
    },
    pkg.province,
    "express"
  );
}

export async function quoteSpx(pkg: CarrierQuoteInput): Promise<CarrierQuoteResult | null> {
  if (!spxEnabled()) return null;

  const appId = String(process.env.SPX_APP_ID || "").trim();
  const appSecret = String(process.env.SPX_APP_SECRET || "").trim();
  const userId = String(process.env.SPX_USER_ID || "").trim();
  const userSecret = String(process.env.SPX_USER_SECRET || "").trim();

  if (!appId || !appSecret || !userId || !userSecret) {
    return baseResult(pkg, estimateFee(pkg), "estimate");
  }

  // Khi có token SPX: gọi API báo giá thật tại đây.
  // Hiện chưa có credential → ước tính.
  return baseResult(pkg, estimateFee(pkg), "estimate");
}

export async function createSpxOrder(input: ShipmentOrderInput): Promise<ShipmentOrderResult> {
  const appId = String(process.env.SPX_APP_ID || "").trim();
  const appSecret = String(process.env.SPX_APP_SECRET || "").trim();
  if (!appId || !appSecret) {
    return { ok: false, error: "Chưa cấu hình SPX_APP_ID/SPX_APP_SECRET — xem docs/HUONG-DAN-DANG-KY-SPX.md" };
  }
  return { ok: false, error: "API tạo vận đơn SPX chưa nối — cần token sau khi đăng ký SPX" };
}
