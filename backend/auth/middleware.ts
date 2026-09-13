import type { Request, Response, NextFunction } from "express";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import {
  ACCESS_COOKIE,
  verifyAccessToken,
  type AccessPayload,
} from "./tokens.js";
import { isAllowedShopOrigin } from "../shopCors.js";

export type AuthRequest = Request & {
  auth?: AccessPayload & { userId: string; active: boolean };
};

export type GetDb = () => Promise<Db>;

const USERS = "aloha_users";

/**
 * Sau restore/backup, `_id` user đôi khi là string thay vì ObjectId.
 * Tìm cả hai dạng để đăng nhập /me không bị 401 oan.
 */
export function userIdQuery(id: string): Record<string, unknown> {
  const sid = String(id || "").trim();
  if (ObjectId.isValid(sid) && String(new ObjectId(sid)) === sid) {
    return { $or: [{ _id: sid }, { _id: new ObjectId(sid) }] };
  }
  return { _id: sid };
}

/**
 * Phiên hợp lệ (kể cả tài khoản chờ duyệt).
 * API nghiệp vụ phải kèm requireActive sau middleware này.
 */
export function requireAuth(getDb: GetDb) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) || bearerToken;
      if (!token) {
        return res.status(401).json({ error: "Chưa đăng nhập" });
      }
      const payload = verifyAccessToken(token);
      const db = await getDb();
      const user = await db.collection(USERS).findOne(userIdQuery(payload.sub));
      if (!user) {
        return res.status(401).json({ error: "Tài khoản không hợp lệ" });
      }
      if (user.approvalStatus === "rejected") {
        return res.status(403).json({ error: "Tài khoản đã bị từ chối" });
      }
      req.auth = {
        sub: payload.sub,
        userId: payload.sub,
        username: String(user.username || payload.username),
        role: user.role === "manager" ? "manager" : "staff",
        active: user.active !== false,
      };
      next();
    } catch {
      return res.status(401).json({ error: "Phiên hết hạn hoặc không hợp lệ" });
    }
  };
}

/** Chặn tài khoản chờ duyệt / bị khóa khỏi API nghiệp vụ */
export function requireActive(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.auth?.active) {
    return res.status(403).json({
      error: "Tài khoản đang chờ Quản lý duyệt",
      code: "PENDING_APPROVAL",
    });
  }
  next();
}

export function requireManager(req: AuthRequest, res: Response, next: NextFunction) {
  const u = (req.auth?.username || "").toLowerCase();
  const isOwner = u === "aloha" || u === "admin";
  if (!req.auth || (req.auth.role !== "manager" && !isOwner)) {
    return res.status(403).json({ error: "Chỉ Quản lý được phép" });
  }
  if (!req.auth.active) {
    return res.status(403).json({ error: "Tài khoản đang chờ duyệt" });
  }
  next();
}

/** CSRF cơ bản: Origin/Referer cùng host, hoặc origin shop được phép (Next rewrite :3002→:3001). */
export function checkSameOrigin(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  const host = req.get("host");
  if (!host) return next();
  const origin = req.get("origin");
  const referer = req.get("referer");
  const okOrigin = origin ? origin.includes(host) : false;
  const okReferer = referer ? referer.includes(host) : false;
  if (!origin && !referer) return next();
  if (okOrigin || okReferer) return next();
  if (origin && isAllowedShopOrigin(origin)) return next();
  if (referer) {
    try {
      const u = new URL(referer);
      if (isAllowedShopOrigin(u.origin)) return next();
    } catch {
      /* ignore */
    }
  }
  return res.status(403).json({ error: "Từ chối Origin không hợp lệ" });
}
