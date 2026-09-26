import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Express } from "express";
import type { Db } from "mongodb";
import { SHOP_ACCOUNTS, SHOP_REFRESH, shopAccountIdQuery } from "../shopAuth/models.js";
import {
  clearPasswordTokensForAccount,
  getPasswordToken,
  putPasswordToken,
  takePasswordToken,
} from "../shopAuth/authEphemeral.js";
import { requireAuth, requireActive, requireManager, type AuthRequest } from "../auth/middleware.js";
import { isAllowedShopOrigin } from "../shopCors.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";
import { clearShopAuthCookies } from "../shopAuth/tokens.js";
import { SI_TERMS_VERSION, normalizeWholesalePhone } from "./policy.js";

const digest = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const origin = () =>
  String(process.env.SHOP_PUBLIC_URL || process.env.NEXT_PUBLIC_SHOP_ORIGIN || "https://alohathegioichaucay.com").replace(
    /\/$/,
    ""
  );

async function makeToken(accountId: string, kind = "reset") {
  const token = crypto.randomBytes(32).toString("hex");
  await putPasswordToken(digest(token), { accountId, kind });
  return `${origin()}/dat-mat-khau?token=${token}`;
}

export function registerWholesalePasswordRoutes(
  app: Express,
  getDb: () => Promise<Db>,
  getOpsDb: () => Promise<Db>
) {
  app.use("/api/shop/auth/password", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.headers.origin && !isAllowedShopOrigin(req.headers.origin)) return res.sendStatus(403);
    if (!(await shopRateLimitOrReject(req, res, "shop_password", 5, 60000))) return;
    next();
  });

  app.post("/api/shop/auth/password/forgot", async (req, res) => {
    const generic = {
      ok: true,
      message:
        "Nếu email có tài khoản, Aloha sẽ gửi hướng dẫn khôi phục. Nếu chưa nhận được, vui lòng liên hệ hỗ trợ.",
    };
    try {
      const parsed = z.string().email().safeParse(String(req.body.email || "").trim().toLowerCase());
      if (!parsed.success) return res.json(generic);
      const db = await getDb();
      const account = await db.collection(SHOP_ACCOUNTS).findOne({ email: parsed.data, active: { $ne: false } });
      if (account && process.env.SHOP_MAIL_ENABLED === "1" && process.env.RESEND_API_KEY && process.env.SHOP_MAIL_FROM) {
        const url = await makeToken(String(account._id));
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.SHOP_MAIL_FROM,
            to: [account.email],
            subject: "ALOHA — Đặt lại mật khẩu",
            text: `Mở liên kết để đặt lại mật khẩu (hiệu lực 30 phút): ${url}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
          }),
          signal: AbortSignal.timeout(10000),
        });
      }
      res.json(generic);
    } catch {
      res.json(generic);
    }
  });

  app.post("/api/shop/auth/password/reset", async (req, res) => {
    try {
      const body = z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/),
          password: z.string().min(8).max(128),
          acceptedTerms: z.boolean().optional(),
        })
        .parse(req.body);
      const db = await getDb();
      const preview = await getPasswordToken(digest(body.token));
      if (!preview) return res.status(400).json({ error: "Liên kết đã hết hạn hoặc đã được sử dụng" });
      if (preview.kind === "invite" && body.acceptedTerms !== true) {
        return res.status(400).json({ error: "Vui lòng đồng ý điều khoản mua sỉ" });
      }
      const record = await takePasswordToken(digest(body.token));
      if (!record) return res.status(409).json({ error: "Liên kết đã được sử dụng" });
      const passwordHash = await bcrypt.hash(body.password, 12);
      const patch: Record<string, unknown> = {
        passwordHash,
        authInvalidBefore: Math.floor(Date.now() / 1000) + 1,
      };
      if (record.kind === "invite") {
        patch["siProfile.acceptedTermsAt"] = new Date().toISOString();
        patch["siProfile.termsVersion"] = SI_TERMS_VERSION;
      }
      await db.collection(SHOP_ACCOUNTS).updateOne(shopAccountIdQuery(record.accountId), { $set: patch });
      await db.collection(SHOP_REFRESH).updateMany({ userId: record.accountId }, { $set: { revokedAt: new Date() } });
      await clearPasswordTokensForAccount(record.accountId);
      clearShopAuthCookies(res);
      res.json({ ok: true });
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.issues?.[0]?.message || "Chưa đổi được mật khẩu. Vui lòng yêu cầu liên kết mới." });
    }
  });

  app.post(
    "/api/shop/admin/si/invite",
    requireAuth(getOpsDb),
    requireActive,
    requireManager,
    async (req: AuthRequest, res) => {
      try {
        const body = z
          .object({
            email: z.string().trim().email(),
            fullName: z.string().trim().min(2).max(120),
            phone: z
              .string()
              .transform(normalizeWholesalePhone)
              .pipe(z.string().regex(/^0[35789]\d{8}$/)),
          })
          .parse(req.body);
        const db = await getDb();
        await db.collection(SHOP_ACCOUNTS).createIndex(
          { phoneNorm: 1 },
          { unique: true, partialFilterExpression: { siIdentity: true, phoneNorm: { $type: "string" } } }
        );
        const email = body.email.toLowerCase();
        const phone = body.phone;
        const byEmail = await db.collection(SHOP_ACCOUNTS).findOne({ email });
        const byPhone = await db.collection(SHOP_ACCOUNTS).findOne({ $or: [{ phone }, { phoneNorm: phone }] });
        if (byEmail && byPhone && String(byEmail._id) !== String(byPhone._id)) {
          return res.status(409).json({
            error: "Email và SĐT đang thuộc hai tài khoản khác nhau. Cần đối soát/gộp tay trước khi mời.",
          });
        }
        if (byPhone && !byEmail && byPhone.email && String(byPhone.email).toLowerCase() !== email) {
          const masked = String(byPhone.email).replace(/(^.).+(@.*$)/, "$1***$2");
          return res
            .status(409)
            .json({ error: `SĐT đã gắn tài khoản ${masked}. Hãy mời đúng email đó (nâng cấp cùng tài khoản).` });
        }
        const existing = byEmail || byPhone || null;
        const now = new Date().toISOString();
        const auditBase = { id: crypto.randomUUID(), actorAdminId: req.auth!.userId, at: now };

        if (existing) {
          if (existing.active === false) {
            return res.status(409).json({ error: "Tài khoản đang khóa. Mở khóa trước khi mời nâng cấp sỉ." });
          }
          const roles = Array.isArray(existing.roles) ? existing.roles.map(String) : [];
          const siStatus = String(existing.siStatus || "");
          if (roles.includes("si") && siStatus === "active") {
            return res.status(409).json({ error: "Tài khoản này đã là khách sỉ đang hoạt động. Không cần mời lại." });
          }
          if (roles.includes("si") && siStatus === "khoa") {
            return res
              .status(409)
              .json({ error: "Tài khoản sỉ đang bị khóa. Mở khóa / duyệt lại thay vì tạo lời mời mới." });
          }
          const nextRoles = [...new Set([...roles.filter(Boolean), "customer", "si"])];
          const phoneOwner = await db.collection(SHOP_ACCOUNTS).findOne({
            _id: { $ne: existing._id },
            $or: [{ phone }, { phoneNorm: phone }],
          });
          if (phoneOwner) {
            return res.status(409).json({ error: "SĐT đang được tài khoản khác sử dụng. Không thể gắn vào lời mời này." });
          }
          const patch: Record<string, unknown> = {
            fullName: body.fullName || existing.fullName,
            phone,
            phoneNorm: phone,
            siIdentity: true,
            roles: nextRoles,
            siStatus: "cho_duyet",
            updatedAt: now,
            "siProfile.fullName": body.fullName,
            "siProfile.phone": phone,
          };
          const result = await db.collection(SHOP_ACCOUNTS).updateOne(
            { _id: existing._id, active: { $ne: false } },
            {
              $set: patch,
              $inc: { applicationRevision: 1 },
              $push: {
                siAudit: {
                  ...auditBase,
                  action: siStatus === "cho_duyet" ? "invite_resend" : "invite_upgrade",
                  fromStatus: siStatus || null,
                  toStatus: "cho_duyet",
                },
              } as any,
            }
          );
          if (!result.modifiedCount) {
            return res.status(409).json({ error: "Hồ sơ vừa thay đổi. Tải lại rồi thử mời lại." });
          }
          const url = await makeToken(String(existing._id), "invite");
          return res.json({
            ok: true,
            mode: "upgrade",
            url,
            message:
              "Đã nâng cấp tài khoản khách sẵn có lên hồ sơ sỉ (chờ duyệt). Gửi liên kết để khách đặt/cập nhật mật khẩu và đồng ý điều khoản.",
          });
        }

        const inserted = await db.collection(SHOP_ACCOUNTS).insertOne({
          email,
          fullName: body.fullName,
          phone,
          phoneNorm: phone,
          siIdentity: true,
          roles: ["customer", "si"],
          siStatus: "cho_duyet",
          active: true,
          applicationRevision: 1,
          siProfile: { fullName: body.fullName, phone },
          createdAt: now,
          updatedAt: now,
          siAudit: [{ ...auditBase, action: "invite" }],
        });
        res.json({
          ok: true,
          mode: "create",
          url: await makeToken(String(inserted.insertedId), "invite"),
          message: "Đã tạo tài khoản sỉ mới (chờ duyệt). Gửi liên kết để khách đặt mật khẩu và đồng ý điều khoản.",
        });
      } catch (error: any) {
        res
          .status(error.code === 11000 ? 409 : 400)
          .json({ error: error.issues?.[0]?.message || "Không tạo được lời mời. Kiểm tra tài khoản trùng." });
      }
    }
  );
}
