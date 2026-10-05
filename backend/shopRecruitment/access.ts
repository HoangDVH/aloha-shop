import type { NextFunction, Response } from "express";
import {
  checkSameOrigin,
  requireActive,
  requireAuth,
  requireManager,
  userIdQuery,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { STAFF_USERS } from "../auth/staffAccounts.js";

export type RecruitmentPermission =
  | "recruitment.jobs.manage"
  | "recruitment.applications.manage"
  | "recruitment.data.delete";

/**
 * Mặc định: chỉ Quản lý. RECRUITMENT_STRICT_PERMISSIONS=1 → Quản lý còn phải có quyền
 * cụ thể (hoặc "recruitment.*") trong users.permissions do app thu mua cấp.
 */
function requirePermission(getOpsDb: GetDb, perm: RecruitmentPermission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (process.env.RECRUITMENT_STRICT_PERMISSIONS !== "1") return next();
    try {
      const db = await getOpsDb();
      const user = await db
        .collection(STAFF_USERS)
        .findOne(userIdQuery(String(req.auth?.userId || "")), { projection: { permissions: 1 } });
      const perms: unknown[] = Array.isArray(user?.permissions) ? user.permissions : [];
      if (perms.includes(perm) || perms.includes("recruitment.*")) return next();
      res.status(403).json({ error: "forbidden", message: "Tài khoản chưa có quyền tuyển dụng." });
    } catch {
      res.status(500).json({ error: "permission_check_failed" });
    }
  };
}

export function recruitmentGate(getOpsDb: GetDb, perm: RecruitmentPermission) {
  return [
    checkSameOrigin,
    requireAuth(getOpsDb),
    requireActive,
    requireManager,
    requirePermission(getOpsDb, perm),
  ];
}
