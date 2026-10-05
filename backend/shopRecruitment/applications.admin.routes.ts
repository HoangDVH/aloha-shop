import fs from "fs";
import type { Express, Response } from "express";
import type { Db } from "mongodb";
import type { AuthRequest, GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import { normalizePhoneVn } from "../shopAuth/ctvApplication.js";
import {
  APPLICATIONS_COL,
  APPLICATION_STATUSES,
  APPOINTMENT_MODES,
  APPLICATION_SOURCES,
  JOBS_COL,
  LIMITS,
  MAX_HISTORY,
  MAX_NOTES,
  SUBMISSION_TYPES,
  type ApplicationStatus,
  type HistoryEvent,
  type RecruitmentApplicationDoc,
  type RecruitmentJobDoc,
} from "./types.js";
import { recruitmentGate } from "./access.js";
import {
  ADMIN_APPLICATION_LIST_PROJECTION,
  actorId,
  ensureRecruitmentIndexes,
  historyEvent,
  newEventId,
  parseId,
  toAdminApplicationDetail,
  toAdminApplicationListItem,
} from "./helpers.js";
import { escapeRegex } from "./validation.js";
import { checkStatusTransition } from "./transitions.js";
import { cvPath, deleteCv } from "./cvStorage.js";
import { CV_FORMAT_META, cvDownloadName } from "./cvFormat.js";
import { readAccountSummary } from "./applicant.js";

const HISTORY_WARN_AT = MAX_HISTORY - 20;

async function detailWithAccount(db: Db, doc: RecruitmentApplicationDoc) {
  const account = doc.accountId ? await readAccountSummary(db, doc.accountId) : null;
  return toAdminApplicationDetail(doc, account);
}

function buildInboxFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const jobId = String(query.jobId || "");
  if (jobId === "none") filter.jobId = { $exists: false };
  else if (parseId(jobId)) filter.jobId = parseId(jobId);
  const status = String(query.status || "");
  if ((APPLICATION_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const type = String(query.submissionType || "");
  if ((SUBMISSION_TYPES as readonly string[]).includes(type)) filter.submissionType = type;
  const source = String(query.source || "");
  if (source === "unknown") filter.source = { $exists: false };
  else if ((APPLICATION_SOURCES as readonly string[]).includes(source)) filter.source = source;
  const hasCv = String(query.hasCv || "");
  if (hasCv === "1") filter["cv.storageKey"] = { $exists: true };
  else if (hasCv === "0") filter["cv.storageKey"] = { $exists: false };
  const q = String(query.q || "").trim().slice(0, LIMITS.search);
  if (q) {
    if (/^TD-[A-Z0-9]{8}$/i.test(q)) filter.publicCode = q.toUpperCase();
    else if (q.includes("@")) filter["contact.email"] = q.toLowerCase();
    else if (/^[\d\s+.-]{8,}$/.test(q)) filter["contact.phone"] = normalizePhoneVn(q);
    else filter["contact.fullName"] = { $regex: escapeRegex(q), $options: "i" };
  }
  return filter;
}

export function registerRecruitmentApplicationsAdminRoutes(
  app: Express,
  getOpsDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = recruitmentGate(getOpsDb, "recruitment.applications.manage");
  const deleteGate = recruitmentGate(getOpsDb, "recruitment.data.delete");
  const appsCol = async () => {
    const db = await getShopDb();
    await ensureRecruitmentIndexes(db);
    return { db, col: db.collection<RecruitmentApplicationDoc>(APPLICATIONS_COL) };
  };

  app.get("/api/shop/admin/recruitment/applications", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { col } = await appsCol();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const filter = buildInboxFilter(req.query as Record<string, unknown>);
      const [total, rows] = await Promise.all([
        col.countDocuments(filter as any, { maxTimeMS: 3000 }),
        col
          .find(filter as any, { projection: ADMIN_APPLICATION_LIST_PROJECTION })
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .maxTimeMS(3000)
          .toArray(),
      ]);
      res.setHeader("Cache-Control", "no-store");
      res.json({
        items: rows.map((r) => toAdminApplicationListItem(r)),
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (e: any) {
      res.status(500).json({ error: "admin_applications_failed", message: e?.message });
    }
  });

  app.get("/api/shop/admin/recruitment/applications/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { db, col } = await appsCol();
      const oid = parseId(req.params.id);
      const doc = oid ? await col.findOne({ _id: oid }) : null;
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({ item: await detailWithAccount(db, doc) });
    } catch (e: any) {
      res.status(500).json({ error: "admin_application_failed", message: e?.message });
    }
  });

  app.patch("/api/shop/admin/recruitment/applications/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { db, col } = await appsCol();
      const oid = parseId(req.params.id);
      const existing = oid ? await col.findOne({ _id: oid }) : null;
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const expectedVersion = Number(req.body?.expectedVersion);
      if (!Number.isInteger(expectedVersion)) {
        res.status(400).json({ error: "missing_version", message: "Thiếu phiên bản. Tải lại trang." });
        return;
      }
      const actor = actorId(req);
      const reason = String(req.body?.reason || "").trim().slice(0, LIMITS.reason) || undefined;
      const set: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};
      const events: HistoryEvent[] = [];

      const rawStatus = req.body?.status;
      if (rawStatus !== undefined) {
        if (!(APPLICATION_STATUSES as readonly string[]).includes(rawStatus)) {
          res.status(400).json({ error: "invalid_status", message: "Trạng thái không hợp lệ" });
          return;
        }
        const to = rawStatus as ApplicationStatus;
        const check = checkStatusTransition(existing.status, to, reason);
        if (check.ok === false) {
          res.status(400).json({ error: "invalid_transition", field: "reason", message: check.message });
          return;
        }
        set.status = to;
        events.push(historyEvent(actor, "status_changed", { fromStatus: existing.status, toStatus: to, reason }));
      }

      if (req.body?.assignedTo !== undefined) {
        const who = String(req.body.assignedTo || "").trim().slice(0, LIMITS.shortLabel);
        if (who !== (existing.assignedTo || "")) {
          if (who) set.assignedTo = who;
          else unset.assignedTo = "";
          events.push(historyEvent(actor, who ? "assigned" : "unassigned", who ? { reason: who } : {}));
        }
      }

      if (req.body?.appointment !== undefined) {
        const a = req.body.appointment;
        if (a === null) {
          if (existing.appointment) {
            unset.appointment = "";
            events.push(historyEvent(actor, "appointment_cleared", { reason }));
          }
        } else {
          const startsAt = new Date(String(a?.startsAt || ""));
          const mode = String(a?.mode || "");
          const locationOrLink = String(a?.locationOrLink || "").trim().slice(0, LIMITS.address);
          const note = String(a?.note || "").trim().slice(0, LIMITS.reason);
          if (!Number.isFinite(startsAt.getTime())) {
            res.status(400).json({ error: "invalid_field", field: "appointment.startsAt", message: "Chọn thời gian hẹn" });
            return;
          }
          if (!(APPOINTMENT_MODES as readonly string[]).includes(mode) || !locationOrLink) {
            res.status(400).json({ error: "invalid_field", field: "appointment", message: "Nhập hình thức và địa điểm/link hẹn" });
            return;
          }
          set.appointment = { startsAt, mode, locationOrLink, ...(note ? { note } : {}) };
          events.push(historyEvent(actor, existing.appointment ? "appointment_changed" : "appointment_set", { reason: startsAt.toISOString() }));
        }
      }

      if (req.body?.linkJobId !== undefined) {
        if (existing.jobId) {
          res.status(409).json({ error: "already_linked", message: "Hồ sơ đã gắn với một tin." });
          return;
        }
        const jid = parseId(req.body.linkJobId);
        const job = jid ? await db.collection<RecruitmentJobDoc>(JOBS_COL).findOne({ _id: jid }) : null;
        if (!job) {
          res.status(400).json({ error: "invalid_field", field: "linkJobId", message: "Tin không tồn tại" });
          return;
        }
        if (!reason) {
          res.status(400).json({ error: "invalid_field", field: "reason", message: "Ghi lý do (ứng viên đã xác nhận qua kênh nào)" });
          return;
        }
        set.jobId = job._id;
        set.jobSummary = { title: job.title, locations: job.locations, employmentType: job.employmentType };
        events.push(historyEvent(actor, "linked_job", { reason: `${job.title} — ${reason}` }));
      }

      if (!events.length) {
        res.status(400).json({ error: "no_changes", message: "Không có thay đổi." });
        return;
      }
      if ((existing.history?.length || 0) + events.length > MAX_HISTORY) {
        res.status(409).json({ error: "history_full", message: "Hồ sơ đã đạt giới hạn lịch sử. Liên hệ kỹ thuật." });
        return;
      }

      set.updatedAt = new Date();
      set.updatedBy = actor;
      const update: Record<string, unknown> = {
        $set: set,
        $push: { history: { $each: events } },
        $inc: { version: 1 },
      };
      if (Object.keys(unset).length) update.$unset = unset;
      const r = await col.updateOne({ _id: oid!, version: expectedVersion } as any, update);
      if (!r.matchedCount) {
        res.status(409).json({ error: "version_conflict", message: "Hồ sơ vừa được người khác cập nhật. Tải lại để xem bản mới." });
        return;
      }
      const next = await col.findOne({ _id: oid! });
      const historyCount = next?.history?.length || 0;
      res.json({
        ok: true,
        item: await detailWithAccount(db, next!),
        ...(historyCount >= HISTORY_WARN_AT ? { warning: `Lịch sử đã có ${historyCount}/${MAX_HISTORY} sự kiện.` } : {}),
      });
    } catch (e: any) {
      res.status(500).json({ error: "patch_failed", message: e?.message });
    }
  });

  app.post("/api/shop/admin/recruitment/applications/:id/notes", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { db, col } = await appsCol();
      const oid = parseId(req.params.id);
      const text = String(req.body?.text || "").trim();
      if (!oid) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (!text || text.length > LIMITS.note) {
        res.status(400).json({ error: "invalid_field", field: "text", message: `Ghi chú 1–${LIMITS.note} ký tự` });
        return;
      }
      const note = { id: newEventId(), authorId: actorId(req), text, createdAt: new Date() };
      const r = await col.updateOne(
        { _id: oid, [`notes.${MAX_NOTES - 1}`]: { $exists: false } } as any,
        { $push: { notes: note }, $set: { updatedAt: new Date() } }
      );
      if (!r.matchedCount) {
        const exists = await col.findOne({ _id: oid }, { projection: { _id: 1 } });
        if (!exists) res.status(404).json({ error: "not_found" });
        else res.status(409).json({ error: "notes_full", message: `Đã đạt tối đa ${MAX_NOTES} ghi chú.` });
        return;
      }
      const next = await col.findOne({ _id: oid });
      res.status(201).json({ ok: true, item: await detailWithAccount(db, next!) });
    } catch (e: any) {
      res.status(500).json({ error: "note_failed", message: e?.message });
    }
  });

  app.get("/api/shop/admin/recruitment/applications/:id/cv", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { col } = await appsCol();
      const oid = parseId(req.params.id);
      const doc = oid ? await col.findOne({ _id: oid }, { projection: { cv: 1, publicCode: 1 } }) : null;
      if (!doc?.cv?.storageKey) {
        res.status(404).json({ error: "not_found", message: "Hồ sơ không có CV." });
        return;
      }
      if (doc.cv.scanStatus === "infected") {
        res.status(423).json({ error: "cv_quarantined", message: "CV bị cách ly do nghi nhiễm mã độc." });
        return;
      }
      const file = cvPath(doc.cv.storageKey);
      const st = await fs.promises.stat(file).catch(() => null);
      if (!st) {
        res.status(404).json({ error: "cv_missing", message: "Không tìm thấy file CV." });
        return;
      }
      const format = doc.cv.format || "pdf";
      const fallbackName = `CV-${doc.publicCode}.${CV_FORMAT_META[format].ext}`;
      const encodedName = encodeURIComponent(cvDownloadName(doc.cv.originalName, format)).replace(
        /['()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
      );
      res.setHeader("Content-Type", CV_FORMAT_META[format].mime);
      res.setHeader("Content-Length", String(st.size));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      res.setHeader("Cache-Control", "no-store");
      fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch (e: any) {
      res.status(500).json({ error: "cv_failed", message: e?.message });
    }
  });

  app.delete("/api/shop/admin/recruitment/applications/:id", ...deleteGate, async (req: AuthRequest, res: Response) => {
    try {
      const { col } = await appsCol();
      const oid = parseId(req.params.id);
      const doc = oid ? await col.findOne({ _id: oid }, { projection: { cv: 1 } }) : null;
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (doc.cv?.storageKey) await deleteCv(doc.cv.storageKey);
      await col.deleteOne({ _id: oid! });
      console.log("[recruitment] application deleted", String(oid), "by", actorId(req));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: "delete_failed", message: "Chưa xóa được (file CV). Thử lại." });
    }
  });
}
