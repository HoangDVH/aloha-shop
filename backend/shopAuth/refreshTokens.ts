/**
 * Kiểm tra refresh token theo RFC 9700 §4.14: mỗi lần /refresh xoay sang token mới cùng "chuỗi phiên"
 * (familyId). Token đã bị xoay mà còn được dùng lại → coi như bị lộ, thu hồi cả chuỗi.
 * Ngoại lệ: trong REFRESH_GRACE_MS ngay sau khi xoay (2 tab/2 request gửi cùng lúc bằng token cũ).
 */
import type { Db } from "mongodb";
import { SHOP_REFRESH } from "./models.js";
import { hashShopToken } from "./tokens.js";

export const REFRESH_GRACE_MS = 60_000;

export type RefreshRevokeReason = "rotated" | "logout" | "reuse";

export type RefreshCheck =
  | { kind: "ok" | "grace"; row: Record<string, unknown> }
  | { kind: "reuse"; familyId: string }
  | { kind: "invalid" };

/** Token cấp trước khi có familyId: chuỗi của nó mang mã jti của chính nó. */
export function refreshFamilyOf(row: Record<string, unknown>): string {
  return String(row.familyId || row.jti);
}

export function classifyRefreshRow(row: Record<string, unknown> | null, token: string, now = Date.now()): RefreshCheck {
  if (!row || row.tokenHash !== hashShopToken(token)) return { kind: "invalid" };
  if (!row.revokedAt) return { kind: "ok", row };
  if (row.revokedReason !== "rotated") return { kind: "invalid" };
  const revokedAt = new Date(row.revokedAt as string | Date).getTime();
  if (now - revokedAt <= REFRESH_GRACE_MS) return { kind: "grace", row };
  return { kind: "reuse", familyId: refreshFamilyOf(row) };
}

export async function checkRefreshToken(db: Db, token: string, jti: string): Promise<RefreshCheck> {
  const row = await db.collection(SHOP_REFRESH).findOne({ jti });
  const check = classifyRefreshRow(row, token);
  if (check.kind === "reuse") await revokeRefreshFamily(db, check.familyId, String(row?.userId || ""));
  return check;
}

/** Thu hồi mọi token của chuỗi (kể cả token mới nhất đang ở máy khách thật — khách phải đăng nhập lại). */
export async function revokeRefreshFamily(db: Db, familyId: string, userId: string) {
  await db
    .collection(SHOP_REFRESH)
    .updateMany({ $or: [{ familyId }, { jti: familyId }] }, { $set: { revokedAt: new Date(), revokedReason: "reuse" satisfies RefreshRevokeReason } });
  console.warn("[shop-auth] refresh token bị dùng lại — đã thu hồi chuỗi phiên", { userId, familyId });
}

/**
 * Đánh dấu token đã xoay. Trả false nếu request khác vừa xoay trước (cùng token, cùng lúc).
 */
export async function markRefreshRotated(db: Db, jti: string): Promise<boolean> {
  const r = await db
    .collection(SHOP_REFRESH)
    .updateOne({ jti, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: "rotated" satisfies RefreshRevokeReason } });
  return r.modifiedCount === 1;
}
