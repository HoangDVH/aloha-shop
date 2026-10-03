import type { Express, Response } from "express";
import type { Db } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb as GetOpsDb,
} from "../../auth/middleware.js";
import { applyShopCors } from "../../shopCors.js";
import {
  archiveCampaign,
  createCampaign,
  deleteCampaign,
  discardDraft,
  duplicateCampaign,
  getCampaign,
  listCampaigns,
  publishCampaign,
  saveDraft,
  scheduleCampaign,
  setCampaignPaused,
} from "../campaignRepo.js";
import { buildPresetContent, listPresets } from "../presets.js";
import { campaignStatusText } from "../statusText.js";
import { CAMPAIGN_ADMIN_MESSAGES as M } from "../messages.js";
import { isAdminFail, productGifts, type AdminResult, type CampaignDoc } from "../types.js";
import { registerCampaignOpsRoutes } from "./ops.routes.js";

type GetDb = () => Promise<Db>;
type Handler = (db: Db, req: AuthRequest) => Promise<AdminResult<unknown>>;

const actorOf = (req: AuthRequest) => String(req.auth?.username || req.auth?.userId || "admin");
const idOf = (req: AuthRequest) => String(req.params.id || "").trim();
const revisionOf = (req: AuthRequest) => Number(req.body?.revision);
const confirmOf = (req: AuthRequest) => (req.body?.reason ? { reason: String(req.body.reason) } : null);

/** Cùng điều kiện với `requireManager`. */
function isManager(req: AuthRequest): boolean {
  const u = (req.auth?.username || "").toLowerCase();
  return req.auth?.role === "manager" || u === "aloha" || u === "admin";
}

function summary(doc: CampaignDoc, nowMs: number) {
  const content = doc.published || doc.draft;
  return {
    id: doc._id,
    name: content.info.name,
    slug: content.info.slug,
    startAt: content.info.startAt,
    endAt: content.info.endAt,
    status: doc.status,
    statusView: campaignStatusText(doc, nowMs),
    revision: doc.revision,
    scheduledAt: doc.scheduledAt,
    productCount: content.products.length,
    voucherCount: content.voucherIds.length,
    giftCount: content.products.reduce((n, p) => n + productGifts(p).length, 0),
    hasUnpublishedChanges: !doc.published || JSON.stringify(doc.published) !== JSON.stringify(doc.draft),
    updatedAt: doc.updatedAt,
  };
}

/** Bọc handler: CORS, chuẩn hoá lỗi, trả `{ok, item}` với trạng thái bằng chữ. */
function wrap(getDb: GetDb, handler: Handler) {
  return async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const r = await handler(await getDb(), req);
      if (isAdminFail(r)) {
        return res.status(r.status).json({ ok: false, code: r.code, error: r.error, fields: r.fields });
      }
      const v = r.value as CampaignDoc | true;
      res.json(v === true ? { ok: true } : { ok: true, item: v, summary: summary(v, Date.now()) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi xử lý chiến dịch" });
    }
  };
}

function registerReads(app: Express, view: unknown[], getDb: GetDb) {
  app.get("/api/shop/admin/campaigns", ...(view as []), async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const nowMs = Date.now();
      const docs = await listCampaigns(await getDb(), String(req.query.all || "") === "1");
      res.json({
        ok: true,
        serverNow: nowMs,
        canManage: isManager(req),
        items: docs.map((d) => summary(d, nowMs)),
        presets: listPresets(),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi tải danh sách chiến dịch" });
    }
  });

  app.get(
    "/api/shop/admin/campaigns/:id",
    ...(view as []),
    wrap(getDb, async (db, req) => {
      const doc = await getCampaign(db, idOf(req));
      return doc ? { ok: true, value: doc } : { ok: false, status: 404, code: "not_found", error: M.notFound };
    })
  );

  /** Nhân viên lưu được chữ / giao diện; server chặn nếu đổi giá, số lượng, quà, voucher, lịch. */
  app.put(
    "/api/shop/admin/campaigns/:id/draft",
    ...(view as []),
    wrap(getDb, (db, req) => saveDraft(db, idOf(req), req.body?.content, revisionOf(req), actorOf(req), isManager(req)))
  );
}

function registerWrites(app: Express, manage: unknown[], getDb: GetDb) {
  const post = (path: string, h: Handler) => app.post(path, ...(manage as []), wrap(getDb, h));

  post("/api/shop/admin/campaigns", async (db, req) => {
    const preset = String(req.body?.preset || "custom");
    return { ok: true, value: await createCampaign(db, buildPresetContent(preset, Date.now()), actorOf(req), preset) };
  });
  post("/api/shop/admin/campaigns/:id/publish", (db, req) =>
    publishCampaign(db, idOf(req), revisionOf(req), actorOf(req), confirmOf(req))
  );
  post("/api/shop/admin/campaigns/:id/schedule", (db, req) =>
    scheduleCampaign(db, idOf(req), revisionOf(req), req.body?.at ? String(req.body.at) : null, actorOf(req), confirmOf(req))
  );
  post("/api/shop/admin/campaigns/:id/discard", (db, req) => discardDraft(db, idOf(req), revisionOf(req), actorOf(req)));
  post("/api/shop/admin/campaigns/:id/pause", (db, req) =>
    setCampaignPaused(db, idOf(req), req.body?.paused !== false, actorOf(req))
  );
  post("/api/shop/admin/campaigns/:id/duplicate", (db, req) => duplicateCampaign(db, idOf(req), actorOf(req)));
  post("/api/shop/admin/campaigns/:id/archive", (db, req) => archiveCampaign(db, idOf(req), actorOf(req)));
  app.delete(
    "/api/shop/admin/campaigns/:id",
    ...(manage as []),
    wrap(getDb, (db, req) => deleteCampaign(db, idOf(req), actorOf(req)))
  );
}

/** Xem: nhân viên đang hoạt động. Sửa / bật / tạm dừng: chỉ quản lý. */
export function registerCampaignAdminRoutes(app: Express, getOpsDb: GetOpsDb, getDb: GetDb) {
  const view = [requireAuth(getOpsDb), requireActive];
  const manage = [requireAuth(getOpsDb), requireActive, requireManager];
  app.options(["/api/shop/admin/campaigns*", "/api/shop/admin/campaign-ops*"], (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });
  registerCampaignOpsRoutes(app, view, manage, getDb);
  registerReads(app, view, getDb);
  registerWrites(app, manage, getDb);
}
