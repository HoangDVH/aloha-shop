import { randomUUID } from "node:crypto";
import type { Express } from "express";
import type { Db } from "mongodb";
import { z } from "zod";
import { requireAuth, requireActive, requireManager, type AuthRequest, type GetDb } from "../auth/middleware.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery, toPublicShopAccount, normalizeCtvCode, isValidCtvCode } from "./models.js";
import { normalizeWholesalePhone, SI_TERMS_VERSION } from "../shopWholesale/policy.js";
import { syncBus } from "../syncBus.js";

const status = z.enum(["active", "cho_duyet", "khoa", "tu_choi"]).nullable();
export const permissionsInput = z.object({
  customerType: z.enum(["retail", "wholesale"]), ctv: z.boolean(),
  activateCtv: z.boolean().optional().default(false),
  ctvCode: z.string().trim().max(20).refine(v => !v || /^[A-Za-z0-9_-]{3,20}$/.test(v)).optional(), reason: z.string().trim().min(3).max(1000),
  expected: z.object({ roles: z.array(z.enum(["customer", "ctv", "si"])), siStatus: status, ctvStatus: status,
    revision: z.number().int().nonnegative() }).strict(),
}).strict();
const revision = (doc: Record<string, any>) => Number(doc.permissionsRevision) || 0;
export async function updateAccountPermissions(db: Db, ref: string, input: z.infer<typeof permissionsInput>, actor: string) {
  const col = db.collection(SHOP_ACCOUNTS), account = await col.findOne(shopAccountIdQuery(ref));
  if (!account) return { status: 404, error: "Không tìm thấy tài khoản" };
  const roles = Array.isArray(account.roles) ? account.roles.map(String) : ["customer"];
  if (revision(account) !== input.expected.revision || JSON.stringify(roles) !== JSON.stringify(input.expected.roles)
    || (account.siStatus ?? null) !== input.expected.siStatus || (account.ctvStatus ?? null) !== input.expected.ctvStatus) {
    return { status: 409, error: "Quyền tài khoản đã thay đổi. Vui lòng tải lại hồ sơ." };
  }
  const wholesale = input.customerType === "wholesale", hasSi = roles.includes("si"), hasCtv = roles.includes("ctv");
  const now = new Date().toISOString(), nextRoles = ["customer", ...(wholesale ? ["si"] : []), ...(input.ctv ? ["ctv"] : [])];
  const patch: Record<string, any> = { roles: nextRoles, updatedAt: now };
  if (wholesale && !hasSi) {
    const phone = normalizeWholesalePhone(String(account.phone || ""));
    if (!/^0[35789]\d{8}$/.test(phone)) return { status: 400, error: "Khách cần bổ sung số điện thoại hợp lệ trước khi gán loại khách sỉ." };
    const hasTerms = account.siProfile?.acceptedTermsAt && account.siProfile?.termsVersion === SI_TERMS_VERSION;
    Object.assign(patch, { siStatus: hasTerms ? "cho_duyet" : "tu_choi", siIdentity: true, phoneNorm: phone });
  } else if (!wholesale && hasSi) patch.siStatus = "khoa";
  const activatingCtv = input.ctv && (!hasCtv || (input.activateCtv && account.ctvStatus !== "active"));
  if (activatingCtv) {
    const previousCode = normalizeCtvCode(account.ctvCode || "");
    const suppliedCode = normalizeCtvCode(input.ctvCode || "");
    if (previousCode && suppliedCode && previousCode !== suppliedCode) return { status: 400, error: "Giữ nguyên mã CTV đã cấp để bảo toàn lịch sử hoa hồng." };
    const code = previousCode || suppliedCode || `CTV${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    if (!isValidCtvCode(code)) return { status: 400, error: "Mã CTV không hợp lệ (3–20 ký tự chữ, số, gạch dưới hoặc gạch ngang)." };
    // Unique index is the authority for concurrent grants; fail if it cannot be created.
    await col.createIndex({ ctvCode: 1 }, { unique: true, sparse: true, background: true });
    Object.assign(patch, { ctvCode: code, ctvStatus: "active", ctvRejectReason: null });
  } else if (!input.ctv && hasCtv) patch.ctvStatus = "khoa";
  const audit = { id: randomUUID(), at: now, actorAdminId: actor, reason: input.reason,
    fromRoles: roles, toRoles: nextRoles, fromSiStatus: account.siStatus ?? null, toSiStatus: patch.siStatus ?? account.siStatus ?? null,
    fromCtvStatus: account.ctvStatus ?? null, toCtvStatus: patch.ctvStatus ?? account.ctvStatus ?? null };
  const exact = (key: string) => account[key] === undefined ? { $exists: false } : account[key];
  try {
    const updated = await col.findOneAndUpdate({ _id: account._id, roles: exact("roles"), siStatus: exact("siStatus"),
      ctvStatus: exact("ctvStatus"), ctvCode: exact("ctvCode"), applicationRevision: exact("applicationRevision"),
      phone: exact("phone"), phoneNorm: exact("phoneNorm"),
      permissionsRevision: exact("permissionsRevision") }, {
      $set: patch, $inc: { permissionsRevision: 1, ...((wholesale !== hasSi) ? { applicationRevision: 1 } : {}) },
      $push: { permissionsAudit: audit } as any,
    }, { returnDocument: "after" });
    if (!updated) return { status: 409, error: "Hồ sơ vừa thay đổi. Vui lòng tải lại trước khi lưu quyền." };
    syncBus.publish([SHOP_ACCOUNTS], "account_permissions_changed", { ids: [String(account._id)] });
    return { status: 200, user: toPublicShopAccount(updated) };
  } catch (error: any) {
    if (error?.code === 11000) return { status: 409, error: "Mã CTV đã được tài khoản khác sử dụng." };
    throw error;
  }
}

export function registerAccountPermissionRoutes(app: Express, authDb: GetDb, shopDb: GetDb) {
  app.patch("/api/shop/admin/accounts/:id/permissions", requireAuth(authDb), requireActive, requireManager, async (req: AuthRequest, res) => {
    const input = permissionsInput.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Thông tin phân quyền không hợp lệ. Nhập lý do và tải lại hồ sơ nếu cần." });
    try {
      const result = await updateAccountPermissions(await shopDb(), String(req.params.id), input.data, req.auth!.userId);
      return res.status(result.status).json(result.user ? { ok: true, user: result.user } : { error: result.error });
    } catch { return res.status(503).json({ error: "Chưa cập nhật được phân quyền. Vui lòng thử lại." }); }
  });
}
