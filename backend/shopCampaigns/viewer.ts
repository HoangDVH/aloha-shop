import type { Db } from "mongodb";
import type { Request } from "express";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { resolveRetailStatus, type RetailStatus } from "./retail.js";

export type CampaignViewer = {
  accountId: string | null;
  account: Record<string, unknown> | null;
  email: string;
  phone: string;
  status: RetailStatus;
};

function readToken(req: Request): string {
  const cookie = String(req.cookies?.[ACCESS_COOKIE] || "").trim();
  if (cookie) return cookie;
  const auth = String(req.headers.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

/** Đăng nhập tuỳ chọn: token hỏng / hết hạn thì xem như khách chưa đăng nhập. */
export async function readCampaignViewer(db: Db, req: Request): Promise<CampaignViewer> {
  let account: Record<string, unknown> | null = null;
  const token = readToken(req);
  if (token) {
    try {
      const payload = verifyShopAccessToken(token);
      if (payload?.sub) account = await db.collection(SHOP_ACCOUNTS).findOne(shopAccountIdQuery(payload.sub));
    } catch {
      account = null;
    }
  }
  const email = String(account?.email || "");
  const phone = String(account?.phone || "");
  const status = await resolveRetailStatus(db, { account, email, phone });
  return { accountId: account ? String(account._id) : null, account, email, phone, status };
}
