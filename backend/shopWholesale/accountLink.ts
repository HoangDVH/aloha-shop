import { normalizeWholesalePhone } from "./policy.js";

/** Các cách viết SĐT cùng một số, để khớp dữ liệu cũ (0..., 84..., +84...). */
export function wholesalePhoneVariants(phone: string): string[] {
  const norm = normalizeWholesalePhone(phone);
  if (!norm) return [];
  const variants = [norm];
  if (norm.startsWith("0")) variants.push(`84${norm.slice(1)}`, `+84${norm.slice(1)}`);
  return [...new Set(variants)];
}

export function phoneOwnerFilter(phone: string) {
  const variants = wholesalePhoneVariants(phone);
  return {
    $or: [
      { phoneNorm: { $in: variants } },
      { phone: { $in: variants } },
    ],
  };
}

export function accountOwnsPhone(account: { phone?: unknown; phoneNorm?: unknown } | null | undefined, phone: string): boolean {
  if (!account) return false;
  const wanted = new Set(wholesalePhoneVariants(phone));
  for (const value of [account.phone, account.phoneNorm]) {
    const norm = normalizeWholesalePhone(value);
    if (wanted.has(norm) || wanted.has(String(value || ""))) return true;
  }
  return false;
}

/** Che email kiểu d***@gmail.com — đủ để khách nhận ra tài khoản, không lộ cả địa chỉ. */
export function maskShopEmail(email: string): string {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at <= 0 || at === raw.length - 1) return "đã đăng ký";
  return `${raw.slice(0, 1)}***@${raw.slice(at + 1)}`;
}

export type PhoneLinkDecision =
  | { action: "use_current" }
  | { action: "create" }
  | { action: "login_required"; maskedEmail: string }
  | { action: "switch_account"; maskedEmail: string };

/**
 * Gắn SĐT với một tài khoản shop, cùng kiểu identifier-first của Shopify / Grab / Auth0:
 * - Đang đăng nhập đúng chủ số → dùng tài khoản đó và gắn thêm Zalo.
 * - Chưa đăng nhập nhưng số đã có chủ → bắt đăng nhập đúng tài khoản, không tạo tài khoản thứ hai.
 * - Đang đăng nhập tài khoản khác → yêu cầu đổi sang tài khoản chủ số (chống chiếm tài khoản).
 */
export function decideWholesalePhoneLink(input: {
  sessionAccountId: string | null;
  ownerIds: string[];
  maskedEmail: string | null;
}): PhoneLinkDecision {
  const owners = [...new Set(input.ownerIds.filter(Boolean))];
  const sessionId = input.sessionAccountId || null;
  const masked = input.maskedEmail || "đã đăng ký";
  if (sessionId && (owners.length === 0 || owners.includes(sessionId))) return { action: "use_current" };
  if (!sessionId && owners.length === 0) return { action: "create" };
  if (!sessionId) return { action: "login_required", maskedEmail: masked };
  return { action: "switch_account", maskedEmail: masked };
}
