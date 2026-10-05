import type { Express, Response } from "express";
import type { Collection, ObjectId } from "mongodb";
import type { AuthRequest, GetDb } from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";
import { slugifyVi } from "../shopArticles/sanitize.js";
import { JOBS_COL, JOB_STATUSES, LIMITS, type JobStatus, type RecruitmentJobDoc } from "./types.js";
import { recruitmentGate } from "./access.js";
import {
  actorId,
  countApplicationsByJob,
  ensureRecruitmentIndexes,
  isDuplicateKeyError,
  parseId,
  toAdminJob,
} from "./helpers.js";
import {
  LOCKED_AFTER_PUBLISH,
  deadlineFromLocalDate,
  escapeRegex,
  jobInputSchema,
  validateJobForOpen,
  zodFirstError,
  type JobInput,
} from "./validation.js";

type JobCol = Collection<RecruitmentJobDoc>;

const OPTIONAL_FIELDS = [
  "department",
  "jobCategory",
  "level",
  "educationRequirement",
  "vacancies",
  "shiftDescription",
  "deadlineAt",
] as const;

const RESERVED_SLUGS = new Set(["quyen-rieng-tu"]);

async function uniqueSlug(col: JobCol, base: string, excludeId?: ObjectId): Promise<string> {
  const root = slugifyVi(base).slice(0, 100) || "viec-lam";
  for (let n = 0; n < 20; n++) {
    const slug = n === 0 ? root : `${root}-${n + 1}`;
    if (RESERVED_SLUGS.has(slug)) continue;
    const filter: Record<string, unknown> = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    if (!(await col.findOne(filter as any, { projection: { _id: 1 } }))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Form admin → trường document; trường tùy chọn rỗng → $unset. */
function jobFieldsFromInput(input: JobInput): {
  set: Partial<RecruitmentJobDoc>;
  unset: string[];
  deadlineInvalid: boolean;
} {
  const deadlineAt = input.deadlineDate ? deadlineFromLocalDate(input.deadlineDate) : undefined;
  const set: Partial<RecruitmentJobDoc> = {
    title: input.title,
    employmentType: input.employmentType,
    locations: input.locations,
    experienceRequirement: input.experienceRequirement,
    salary: input.salary,
    description: input.description,
    requirements: input.requirements,
    benefits: input.benefits,
    cvRequired: input.cvRequired,
  };
  const optional: Record<(typeof OPTIONAL_FIELDS)[number], unknown> = {
    department: input.department,
    jobCategory: input.jobCategory,
    level: input.level,
    educationRequirement: input.educationRequirement,
    vacancies: input.vacancies,
    shiftDescription: input.shiftDescription,
    deadlineAt: deadlineAt || undefined,
  };
  const unset: string[] = [];
  for (const k of OPTIONAL_FIELDS) {
    if (optional[k] === undefined) unset.push(k);
    else (set as Record<string, unknown>)[k] = optional[k];
  }
  return { set, unset, deadlineInvalid: Boolean(input.deadlineDate) && !deadlineAt };
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  if (to === "draft") return false;
  return true;
}

export function registerRecruitmentJobsAdminRoutes(app: Express, getOpsDb: GetDb, getShopDb: GetShopDb) {
  const gate = recruitmentGate(getOpsDb, "recruitment.jobs.manage");
  const jobsCol = async () => {
    const db = await getShopDb();
    await ensureRecruitmentIndexes(db);
    return { db, col: db.collection<RecruitmentJobDoc>(JOBS_COL) };
  };

  app.get("/api/shop/admin/recruitment/jobs", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { db, col } = await jobsCol();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const status = String(req.query.status || "");
      const q = String(req.query.q || "").trim().slice(0, LIMITS.search);
      const filter: Record<string, unknown> = {};
      if ((JOB_STATUSES as readonly string[]).includes(status)) filter.status = status;
      if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
      const [total, rows] = await Promise.all([
        col.countDocuments(filter as any),
        col
          .find(filter as any)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
      ]);
      const counts = await countApplicationsByJob(db, rows.map((r) => r._id!));
      res.json({
        items: rows.map((r) => toAdminJob(r, counts.get(String(r._id)) || 0)),
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (e: any) {
      res.status(500).json({ error: "admin_jobs_failed", message: e?.message });
    }
  });

  app.get("/api/shop/admin/recruitment/jobs/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { db, col } = await jobsCol();
      const oid = parseId(req.params.id);
      const doc = oid ? await col.findOne({ _id: oid }) : null;
      if (!doc) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const counts = await countApplicationsByJob(db, [doc._id!]);
      res.json({ item: toAdminJob(doc, counts.get(String(doc._id)) || 0) });
    } catch (e: any) {
      res.status(500).json({ error: "admin_job_failed", message: e?.message });
    }
  });

  app.post("/api/shop/admin/recruitment/jobs", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = jobInputSchema.safeParse(req.body?.fields ?? req.body);
      if (!parsed.success) {
        const { field, message } = zodFirstError(parsed.error);
        res.status(400).json({ error: "invalid_field", field, message });
        return;
      }
      const { set, deadlineInvalid } = jobFieldsFromInput(parsed.data);
      if (deadlineInvalid) {
        res.status(400).json({ error: "invalid_field", field: "deadlineDate", message: "Hạn nộp không hợp lệ" });
        return;
      }
      const { col } = await jobsCol();
      const now = new Date();
      const by = actorId(req);
      const doc = {
        ...set,
        slug: await uniqueSlug(col, parsed.data.slug || parsed.data.title),
        status: "draft",
        createdBy: by,
        updatedBy: by,
        createdAt: now,
        updatedAt: now,
        version: 1,
      } as RecruitmentJobDoc;
      const r = await col.insertOne(doc);
      res.status(201).json({ ok: true, item: toAdminJob({ ...doc, _id: r.insertedId }) });
    } catch (e: any) {
      if (isDuplicateKeyError(e)) {
        res.status(409).json({ error: "slug_taken", field: "slug", message: "Đường dẫn đã dùng." });
        return;
      }
      res.status(500).json({ error: "create_failed", message: e?.message });
    }
  });

  app.post(
    "/api/shop/admin/recruitment/jobs/:id/duplicate",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const { col } = await jobsCol();
        const oid = parseId(req.params.id);
        const src = oid ? await col.findOne({ _id: oid }) : null;
        if (!src) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const now = new Date();
        const by = actorId(req);
        const { _id, publishedAt, deadlineAt, ...rest } = src;
        const doc = {
          ...rest,
          slug: await uniqueSlug(col, src.title),
          status: "draft",
          createdBy: by,
          updatedBy: by,
          createdAt: now,
          updatedAt: now,
          version: 1,
        } as RecruitmentJobDoc;
        const r = await col.insertOne(doc);
        res.status(201).json({ ok: true, item: toAdminJob({ ...doc, _id: r.insertedId }) });
      } catch (e: any) {
        res.status(500).json({ error: "duplicate_failed", message: e?.message });
      }
    }
  );

  app.patch("/api/shop/admin/recruitment/jobs/:id", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const { db, col } = await jobsCol();
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

      let set: Partial<RecruitmentJobDoc> = {};
      let unset: string[] = [];
      if (req.body?.fields) {
        const parsed = jobInputSchema.safeParse(req.body.fields);
        if (!parsed.success) {
          const { field, message } = zodFirstError(parsed.error);
          res.status(400).json({ error: "invalid_field", field, message });
          return;
        }
        const mapped = jobFieldsFromInput(parsed.data);
        if (mapped.deadlineInvalid) {
          res.status(400).json({ error: "invalid_field", field: "deadlineDate", message: "Hạn nộp không hợp lệ" });
          return;
        }
        set = mapped.set;
        unset = mapped.unset;
        if (existing.publishedAt) {
          for (const k of LOCKED_AFTER_PUBLISH) {
            const next = unset.includes(k) ? undefined : (set as Record<string, unknown>)[k];
            if (!sameValue(next, (existing as Record<string, unknown>)[k])) {
              res.status(409).json({
                error: "locked_after_publish",
                field: k,
                message:
                  "Tin đã đăng chỉ được sửa diễn đạt. Đổi nơi làm, lương, loại hình, yêu cầu hoặc CV: đóng tin rồi «Nhân bản» thành đợt mới.",
              });
              return;
            }
          }
          if (parsed.data.slug && parsed.data.slug !== existing.slug) {
            res.status(409).json({ error: "slug_locked", field: "slug", message: "Không đổi đường dẫn sau khi đã đăng." });
            return;
          }
        } else if (parsed.data.slug && slugifyVi(parsed.data.slug) !== existing.slug) {
          set.slug = await uniqueSlug(col, parsed.data.slug, oid!);
        }
      }

      const merged = { ...existing, ...set } as RecruitmentJobDoc;
      for (const k of unset) delete (merged as Record<string, unknown>)[k];

      const rawStatus = req.body?.status;
      const targetStatus: JobStatus = rawStatus ?? existing.status;
      if (rawStatus !== undefined) {
        if (!(JOB_STATUSES as readonly string[]).includes(rawStatus) || !canTransition(existing.status, rawStatus)) {
          res.status(400).json({ error: "invalid_status", message: "Không chuyển được trạng thái tin." });
          return;
        }
        set.status = rawStatus;
      }
      if (targetStatus === "open") {
        const errors = validateJobForOpen(merged, { requireFutureDeadline: rawStatus === "open" });
        if (errors.length) {
          res.status(400).json({ error: "not_ready_to_open", field: errors[0].field, message: errors[0].message, errors });
          return;
        }
        if (!existing.publishedAt) set.publishedAt = new Date();
      }

      set.updatedAt = new Date();
      set.updatedBy = actorId(req);
      const update: Record<string, unknown> = { $set: set, $inc: { version: 1 } };
      if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, ""]));
      const r = await col.updateOne({ _id: oid!, version: expectedVersion } as any, update);
      if (!r.matchedCount) {
        res.status(409).json({ error: "version_conflict", message: "Tin vừa được người khác sửa. Tải lại để xem bản mới." });
        return;
      }
      const next = await col.findOne({ _id: oid! });
      const counts = await countApplicationsByJob(db, [oid!]);
      res.json({ ok: true, item: toAdminJob(next!, counts.get(String(oid)) || 0) });
    } catch (e: any) {
      if (isDuplicateKeyError(e)) {
        res.status(409).json({ error: "slug_taken", field: "slug", message: "Đường dẫn đã dùng." });
        return;
      }
      res.status(500).json({ error: "patch_failed", message: e?.message });
    }
  });
}
