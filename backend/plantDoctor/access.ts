import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import {
  checkSameOrigin,
  requireActive,
  requireAuth,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { shopTestBuyerEmails } from "../shopOrders/checkoutFlags.js";
import { SHOP_ACCOUNTS, shopAccountIdQuery } from "../shopAuth/models.js";
import { ACCESS_COOKIE, verifyShopAccessToken } from "../shopAuth/tokens.js";
import { geminiKey } from "./gemini.js";
import { plantNetKey } from "./plantnet.js";
import { PROFILES } from "./profiles/index.js";
import { isProfileReviewed, loadProfileReviews, setProfileReviewed } from "./reviews.js";

/** Bật/tắt Bác sĩ cây: mặc định chỉ tài khoản test dùng được, admin mở cho tất cả khi sẵn sàng. */
export const FEATURE_SETTINGS_COL = "shop_feature_settings";
const SETTINGS_ID = "plant_doctor";
const MAX_TEST_EMAILS = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CACHE_MS = 15_000;

export type PlantDoctorSettings = { enabledForAll: boolean; testEmails: string[] };
type SettingsDoc = PlantDoctorSettings & { _id: string; updatedAt?: Date; updatedBy?: string };

export const FEATURE_DISABLED_MESSAGE = "Tính năng Bác sĩ cây cảnh đang được phát triển, bạn quay lại sau nhé.";

let cache: { at: number; value: PlantDoctorSettings } | null = null;

export function resetPlantDoctorSettingsCache() {
  cache = null;
}

/** Tách danh sách email admin nhập (phẩy, chấm phẩy, xuống dòng); trả email lỗi để báo lại. */
export function parseTestEmails(raw: unknown): { emails: string[]; invalid: string[] } {
  const list = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(/[,;\s]+/);
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const item of list) {
    const e = item.trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e) || e.length > 120) invalid.push(item.trim());
    else if (!emails.includes(e)) emails.push(e);
  }
  return { emails, invalid };
}

export async function loadPlantDoctorSettings(db: Db): Promise<PlantDoctorSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await db.collection<SettingsDoc>(FEATURE_SETTINGS_COL).findOne({ _id: SETTINGS_ID });
  const value: PlantDoctorSettings = {
    enabledForAll: doc?.enabledForAll === true,
    testEmails: parseTestEmails(doc?.testEmails ?? []).emails,
  };
  cache = { at: Date.now(), value };
  return value;
}

export function canUsePlantDoctor(settings: PlantDoctorSettings, email: string | null | undefined): boolean {
  if (settings.enabledForAll) return true;
  const e = String(email || "").trim().toLowerCase();
  return Boolean(e) && (settings.testEmails.includes(e) || shopTestBuyerEmails().includes(e));
}

/** Email tài khoản shop đang đăng nhập; phiên hỏng/hết hạn/bị khoá thì xem như khách. */
async function readShopEmail(db: Db, req: Request): Promise<string | null> {
  const token = String(req.cookies?.[ACCESS_COOKIE] || "").trim();
  if (!token) return null;
  try {
    const payload = verifyShopAccessToken(token);
    if (!payload?.sub) return null;
    const account = await db
      .collection(SHOP_ACCOUNTS)
      .findOne(shopAccountIdQuery(payload.sub), { projection: { email: 1, active: 1, authInvalidBefore: 1 } });
    if (!account || account.active === false) return null;
    if (Number(payload.iat || 0) < Number(account.authInvalidBefore || 0)) return null;
    return String(account.email || "").toLowerCase() || null;
  } catch {
    return null;
  }
}

export type PlantDoctorAccess = { allowed: boolean; enabledForAll: boolean; tester: boolean };

/** Lỗi đọc DB thì coi như chưa mở cho tất cả (an toàn), tài khoản test trong env vẫn dùng được. */
export async function readPlantDoctorAccess(getDb: GetDb, req: Request): Promise<PlantDoctorAccess> {
  let db: Db | null = null;
  let settings: PlantDoctorSettings = { enabledForAll: false, testEmails: [] };
  try {
    db = await getDb();
    settings = await loadPlantDoctorSettings(db);
  } catch (e) {
    console.warn("[plant-doctor] không đọc được cài đặt:", (e as Error)?.message);
  }
  if (settings.enabledForAll) return { allowed: true, enabledForAll: true, tester: false };
  const email = db ? await readShopEmail(db, req) : null;
  const allowed = canUsePlantDoctor(settings, email);
  return { allowed, enabledForAll: false, tester: allowed };
}

const serverStatus = () => ({
  envTestEmails: shopTestBuyerEmails(),
  plantNetConfigured: Boolean(plantNetKey()),
  geminiConfigured: Boolean(geminiKey()),
});

export function registerPlantDoctorAccessRoutes(app: Express, getOpsDb: GetDb, getDb: GetDb) {
  app.get("/api/shop/plant-doctor/access", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await readPlantDoctorAccess(getDb, req));
  });

  const gate = [checkSameOrigin, requireAuth(getOpsDb), requireActive, requireManager];

  app.get("/api/shop/admin/plant-doctor/settings", ...gate, async (_req: AuthRequest, res: Response) => {
    try {
      const settings = await loadPlantDoctorSettings(await getDb());
      res.json({ ...settings, ...serverStatus() });
    } catch {
      res.status(500).json({ error: "settings_read_failed" });
    }
  });

  app.get("/api/shop/admin/plant-doctor/profiles", ...gate, async (_req: AuthRequest, res: Response) => {
    try {
      const reviews = await loadProfileReviews(await getDb());
      res.json({
        profiles: PROFILES.map((p) => {
          const r = reviews.get(p.id);
          return { ...p, reviewed: isProfileReviewed(p, reviews), reviewedAt: r?.reviewedAt ?? null, reviewedBy: r?.reviewedBy ?? null };
        }),
      });
    } catch {
      res.status(500).json({ error: "profiles_read_failed" });
    }
  });

  app.put("/api/shop/admin/plant-doctor/profiles/:id/review", ...gate, async (req: AuthRequest, res: Response) => {
    const reviewed = (req.body as { reviewed?: unknown } | undefined)?.reviewed;
    if (typeof reviewed !== "boolean") {
      return res.status(400).json({ error: "invalid", message: "Thiếu trạng thái duyệt." });
    }
    try {
      const by = String(req.auth?.username || req.auth?.userId || "admin");
      const ok = await setProfileReviewed(await getDb(), String(req.params.id || ""), reviewed, by);
      if (!ok) return res.status(404).json({ error: "not_found", message: "Không có hồ sơ loài này." });
      res.json({ ok: true, reviewed });
    } catch {
      res.status(500).json({ error: "review_save_failed" });
    }
  });

  app.put("/api/shop/admin/plant-doctor/settings", ...gate, async (req: AuthRequest, res: Response) => {
    const body = (req.body || {}) as { enabledForAll?: unknown; testEmails?: unknown };
    if (typeof body.enabledForAll !== "boolean") {
      return res.status(400).json({ error: "invalid", message: "Thiếu trạng thái bật/tắt." });
    }
    const { emails, invalid } = parseTestEmails(body.testEmails ?? []);
    if (invalid.length) {
      return res.status(400).json({ error: "invalid_email", message: `Email không hợp lệ: ${invalid.slice(0, 3).join(", ")}` });
    }
    if (emails.length > MAX_TEST_EMAILS) {
      return res.status(400).json({ error: "too_many", message: `Tối đa ${MAX_TEST_EMAILS} email test.` });
    }
    try {
      const db = await getDb();
      await db.collection<SettingsDoc>(FEATURE_SETTINGS_COL).updateOne(
        { _id: SETTINGS_ID },
        {
          $set: {
            enabledForAll: body.enabledForAll,
            testEmails: emails,
            updatedAt: new Date(),
            updatedBy: String(req.auth?.userId || ""),
          },
        },
        { upsert: true }
      );
      resetPlantDoctorSettingsCache();
      const settings = await loadPlantDoctorSettings(db);
      res.json({ ...settings, ...serverStatus() });
    } catch {
      res.status(500).json({ error: "settings_save_failed" });
    }
  });
}
