import type { Express, Response } from "express";
import type { Db } from "mongodb";
import type { AuthRequest } from "../../auth/middleware.js";
import { applyShopCors } from "../../shopCors.js";
import { getCampaign } from "../campaignRepo.js";
import { runPrepublishChecks } from "../admin/prepublishChecks.js";
import { loadProductFacts } from "../admin/productFacts.js";
import { buildCampaignReport, campaignReportXlsx } from "../admin/campaignReport.js";
import { PREVIEW_TTL_SEC, signPreviewToken } from "../preview.js";
import {
  lastReconcileReport,
  needsReviewOrders,
  resolveNeedsReview,
  runningSummary,
  saveReconcileReport,
} from "../admin/opsService.js";
import { loadCampaignStats } from "../stats/campaignStats.js";
import { reconcileFlashCounters } from "../worker/reconcileCounters.js";
import { CAMPAIGN_ADMIN_MESSAGES as M } from "../messages.js";

type GetDb = () => Promise<Db>;
type Json = (db: Db, req: AuthRequest) => Promise<{ status?: number; body: Record<string, unknown> }>;

const actorOf = (req: AuthRequest) => String(req.auth?.username || req.auth?.userId || "admin");

function json(getDb: GetDb, fn: Json) {
  return async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const r = await fn(await getDb(), req);
      res.status(r.status || 200).json(r.body);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Lỗi xử lý chiến dịch" });
    }
  };
}

const notFound = { status: 404, body: { ok: false, code: "not_found", error: M.notFound } };

/** Kiểm tra trước khi bật, trang "Đang chạy", đối soát bộ đếm (WK04), đơn cần xử lý tay (FS13). */
export function registerCampaignOpsRoutes(app: Express, view: unknown[], manage: unknown[], getDb: GetDb) {
  app.get("/api/shop/admin/campaigns/:id/check", ...(view as []), json(getDb, async (db, req) => {
    const doc = await getCampaign(db, String(req.params.id));
    if (!doc) return notFound;
    const report = await runPrepublishChecks(db, doc);
    return { body: { ok: true, issues: report.issues, facts: report.facts } };
  }));

  app.post("/api/shop/admin/campaigns/:id/preview-token", ...(view as []), json(getDb, async (db, req) => {
    const doc = await getCampaign(db, String(req.params.id));
    if (!doc) return notFound;
    return { body: { ok: true, token: signPreviewToken(doc._id, actorOf(req)), expiresInSec: PREVIEW_TTL_SEC } };
  }));

  app.get("/api/shop/admin/campaigns/:id/running", ...(view as []), json(getDb, async (db, req) => {
    const doc = await getCampaign(db, String(req.params.id));
    if (!doc) return notFound;
    const content = doc.published || doc.draft;
    const [summary, stats, review, reconcile] = await Promise.all([
      runningSummary(db, doc._id, content),
      loadCampaignStats(db, doc._id),
      needsReviewOrders(db),
      lastReconcileReport(db),
    ]);
    return { body: { ok: true, summary, stats, needsReview: review, reconcile } };
  }));

  app.get("/api/shop/admin/campaigns/:id/report.xlsx", ...(view as []), async (req: AuthRequest, res: Response) => {
    applyShopCors(req, res);
    try {
      const db = await getDb();
      const doc = await getCampaign(db, String(req.params.id));
      if (!doc) return res.status(404).json(notFound.body);
      const file = await campaignReportXlsx(await buildCampaignReport(db, doc));
      const slug = (doc.published || doc.draft).info.slug.replace(/[^a-z0-9-]/gi, "") || "chien-dich";
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="bao-cao-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.setHeader("Cache-Control", "no-store");
      res.end(file);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Không xuất được báo cáo" });
    }
  });

  app.get("/api/shop/admin/campaign-ops/facts", ...(view as []), json(getDb, async (db, req) => {
    const mas = String(req.query.mas || "").split(",").slice(0, 300);
    return { body: { ok: true, facts: Object.fromEntries(await loadProductFacts(db, mas)) } };
  }));

  app.get("/api/shop/admin/campaign-ops/reconcile", ...(view as []), json(getDb, async (db) => {
    const r = await reconcileFlashCounters(db, { fix: false, quietMs: 0 });
    return { body: { ok: true, diffs: r.diffs, last: await lastReconcileReport(db) } };
  }));

  app.post("/api/shop/admin/campaign-ops/reconcile", ...(manage as []), json(getDb, async (db, req) => {
    const r = await reconcileFlashCounters(db, { fix: true });
    await saveReconcileReport(db, { at: new Date().toISOString(), ...r, source: actorOf(req) });
    return { body: { ok: true, diffs: r.diffs, fixed: r.fixed } };
  }));

  app.post("/api/shop/admin/campaign-ops/review/:code/resolve", ...(manage as []), json(getDb, async (db, req) => {
    const ok = await resolveNeedsReview(db, String(req.params.code), actorOf(req), String(req.body?.note || ""));
    return ok ? { body: { ok: true } } : { status: 404, body: { ok: false, error: "Đơn không còn trong danh sách cần xử lý." } };
  }));
}
