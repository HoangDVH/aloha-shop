import type { Request } from "express";
import type { Db } from "mongodb";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";

/**
 * Đăng nhập tuỳ chọn khi nộp hồ sơ: token thiếu/hỏng/hết hạn hoặc tài khoản bị khóa
 * thì xem như khách — không bao giờ chặn nộp hồ sơ vì lỗi phiên.
 */
export async function readApplicantAccountId(db: Db, req: Request): Promise<string | null> {
  const token = String(req.cookies?.[ACCESS_COOKIE] || "").trim();
  if (!token) return null;
  try {
    const payload = verifyShopAccessToken(token);
    if (!payload?.sub) return null;
    const account = await db
      .collection(SHOP_ACCOUNTS)
      .findOne(shopAccountIdQuery(payload.sub), { projection: { active: 1, authInvalidBefore: 1 } });
    if (!account || account.active === false) return null;
    if (Number(payload.iat || 0) < Number(account.authInvalidBefore || 0)) return null;
    return String(account._id);
  } catch {
    return null;
  }
}

/** Tóm tắt tài khoản cho drawer admin (chỉ trường nhận diện, không trả dữ liệu mua hàng). */
export async function readAccountSummary(
  db: Db,
  accountId: string
): Promise<{ id: string; email: string; fullName: string; active: boolean } | null> {
  try {
    const doc = await db
      .collection(SHOP_ACCOUNTS)
      .findOne(shopAccountIdQuery(accountId), { projection: { email: 1, fullName: 1, active: 1 } });
    if (!doc) return null;
    return {
      id: String(doc._id),
      email: String(doc.email || ""),
      fullName: String(doc.fullName || ""),
      active: doc.active !== false,
    };
  } catch {
    return null;
  }
}
