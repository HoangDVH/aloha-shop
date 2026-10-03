import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, normalizeEmail } from "../shopAuth/models.js";
import { normalizeVietnamesePhone } from "../shopPromotions/phoneNormalization.js";
import { isShopTestBuyerEmail } from "../shopOrders/checkoutFlags.js";

const NON_RETAIL_ROLES = ["si", "wholesale", "ctv"];

type AccountLike = { roles?: unknown; active?: unknown; email?: unknown; _id?: unknown } | null | undefined;

/** Khách lẻ = không có vai trò sỉ / CTV, bất kể trạng thái duyệt. */
export function isRetailAccount(account: AccountLike): boolean {
  if (!account) return true;
  const roles = Array.isArray(account.roles) ? account.roles.map(String) : [];
  return !roles.some((r) => NON_RETAIL_ROLES.includes(r));
}

function phoneVariants(phone: string): string[] {
  const raw = String(phone || "").trim();
  if (!raw) return [];
  const n = normalizeVietnamesePhone(raw);
  return n.valid ? [...new Set([raw, n.localPhone!, n.normalized!])] : [raw];
}

/** Khách không đăng nhập nhưng dùng SĐT / email của tài khoản có sẵn thì xét như tài khoản đó. */
async function findAccountByContact(shopDb: Db, phone: string, email: string): Promise<AccountLike> {
  const or: Record<string, unknown>[] = [];
  const phones = phoneVariants(phone);
  if (phones.length) or.push({ phone: { $in: phones } });
  const mail = normalizeEmail(email);
  if (mail) or.push({ email: mail });
  if (!or.length) return null;
  return (await shopDb
    .collection(SHOP_ACCOUNTS)
    .find({ $or: or }, { projection: { roles: 1, active: 1, email: 1 } })
    .limit(5)
    .toArray()
    .then((rows) => rows.find((r) => !isRetailAccount(r)) || rows[0] || null)) as AccountLike;
}

export type RetailStatus = {
  retail: boolean;
  locked: boolean;
  isTestBuyer: boolean;
};

export async function resolveRetailStatus(
  shopDb: Db,
  input: { account?: AccountLike; phone?: string; email?: string }
): Promise<RetailStatus> {
  const account = input.account || (await findAccountByContact(shopDb, input.phone || "", input.email || ""));
  const email = String(account?.email || input.email || "");
  return {
    retail: isRetailAccount(account),
    locked: Boolean(account && account.active === false),
    isTestBuyer: isShopTestBuyerEmail(email),
  };
}

/** Được hưởng ưu đãi chiến dịch: khách lẻ và tài khoản không bị khoá. */
export async function isRetailBuyer(
  shopDb: Db,
  account: AccountLike,
  phone?: string,
  email?: string
): Promise<boolean> {
  const s = await resolveRetailStatus(shopDb, { account, phone, email });
  return s.retail && !s.locked;
}
