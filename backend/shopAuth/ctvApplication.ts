import type { Db } from "mongodb";
import { normalizeCtvCode, isValidCtvCode, SHOP_ACCOUNTS } from "./models.js";

/** Field hồ sơ đăng ký CTV (P0) — dùng chung register + PATCH /me + admin. */

export type CtvApplicationFields = {
  zalo: string;
  addressText: string;
  referralChannel: string;
  channelUrl: string;
  referralSource: string;
  hasBusinessExp: boolean;
  businessExpNote: string;
  businessExpYears: number | null;
};

const CHANNELS = new Set([
  "facebook",
  "tiktok",
  "youtube",
  "zalo",
  "website",
  "khac",
]);

/** Chuẩn hóa SĐT VN → 0xxxxxxxxx */
export function normalizePhoneVn(raw: string): string {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("84") && s.length >= 11) s = `0${s.slice(2)}`;
  return s;
}

export function isValidPhoneVn(raw: string): boolean {
  const s = normalizePhoneVn(raw);
  return /^0\d{9,10}$/.test(s);
}

export function isValidZalo(raw: string): boolean {
  const t = String(raw || "").trim();
  if (!t) return false;
  if (/^https?:\/\/(www\.)?zalo\.me\//i.test(t)) return true;
  return isValidPhoneVn(t);
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Parse + validate hồ sơ CTV từ body. */
export function parseCtvApplicationBody(
  body: Record<string, unknown> | null | undefined
): { ok: true; fields: CtvApplicationFields } | { ok: false; error: string } {
  const zalo = String(body?.zalo || "").trim();
  const addressText = String(body?.addressText || body?.address || "").trim();
  const referralChannel = String(body?.referralChannel || "")
    .trim()
    .toLowerCase();
  const channelUrl = String(body?.channelUrl || "").trim();
  const referralSource = String(body?.referralSource || "").trim();

  const hasRaw = body?.hasBusinessExp;
  const hasBusinessExp =
    hasRaw === true || hasRaw === "true" || hasRaw === 1 || hasRaw === "1";

  const businessExpNote = String(body?.businessExpNote || "").trim();
  const yearsRaw = body?.businessExpYears;
  const businessExpYears =
    yearsRaw === "" || yearsRaw == null ? null : Number(yearsRaw);

  if (!isValidZalo(zalo)) {
    return { ok: false, error: "Zalo không hợp lệ (SĐT hoặc link zalo.me)" };
  }
  if (!addressText) {
    return { ok: false, error: "Nhập địa chỉ" };
  }
  if (!CHANNELS.has(referralChannel)) {
    return { ok: false, error: "Chọn kênh bán" };
  }
  if (!isValidHttpUrl(channelUrl)) {
    return { ok: false, error: "Link kênh phải bắt đầu bằng http:// hoặc https://" };
  }
  if (typeof hasRaw === "undefined" || hasRaw === null || hasRaw === "") {
    return { ok: false, error: "Chọn đã có / chưa có kinh nghiệm kinh doanh" };
  }
  if (hasBusinessExp) {
    if (!businessExpNote) {
      return { ok: false, error: "Nhập bạn đang / đã kinh doanh gì" };
    }
    if (
      businessExpYears == null ||
      !Number.isFinite(businessExpYears) ||
      !Number.isInteger(businessExpYears) ||
      businessExpYears < 1 ||
      businessExpYears > 50
    ) {
      return { ok: false, error: "Số năm kinh nghiệm từ 1 đến 50" };
    }
  }

  return {
    ok: true,
    fields: {
      zalo,
      addressText,
      referralChannel,
      channelUrl,
      referralSource,
      hasBusinessExp,
      businessExpNote: hasBusinessExp ? businessExpNote : "",
      businessExpYears: hasBusinessExp ? businessExpYears : null,
    },
  };
}

export function ctvApplicationToDoc(fields: CtvApplicationFields): Record<string, unknown> {
  return {
    zalo: fields.zalo,
    addressText: fields.addressText,
    referralChannel: fields.referralChannel,
    channelUrl: fields.channelUrl,
    referralSource: fields.referralSource || null,
    hasBusinessExp: fields.hasBusinessExp,
    businessExpNote: fields.businessExpNote || null,
    businessExpYears: fields.businessExpYears,
    ctvRejectReason: null,
  };
}

/** Sinh mã CTV từ email, thử hậu tố nếu trùng. */
export async function allocateCtvCode(
  db: Db,
  email: string,
  excludeId?: unknown
): Promise<string | null> {
  let base = normalizeCtvCode(String(email || "").split("@")[0] || "CTV");
  if (!isValidCtvCode(base)) base = "CTV";
  for (let n = 0; n < 30; n++) {
    const tryCode = n === 0 ? base : normalizeCtvCode(`${base}${n}`);
    if (!isValidCtvCode(tryCode)) continue;
    const q: Record<string, unknown> = { ctvCode: tryCode };
    if (excludeId != null) q._id = { $ne: excludeId };
    const taken = await db.collection(SHOP_ACCOUNTS).findOne(q);
    if (!taken) return tryCode;
  }
  return null;
}
