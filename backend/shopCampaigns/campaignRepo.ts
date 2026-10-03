import type { Db } from "mongodb";
import { randomUUID } from "node:crypto";
import { PROMOTION_AUDIT_COL } from "../shopPromotions/types.js";
import { syncBus } from "../syncBus.js";
import { CAMPAIGN_ADMIN_MESSAGES as M } from "./messages.js";
import { isInvalidCampaign, validateCampaignContent } from "./schema.js";
import { clearCurrentCampaignCache } from "./currentCampaign.js";
import { runPrepublishChecks } from "./admin/prepublishChecks.js";
import {
  CAMPAIGNS_COL,
  type AdminResult,
  type CampaignContent,
  type CampaignDoc,
} from "./types.js";

const col = (db: Db) => db.collection<CampaignDoc>(CAMPAIGNS_COL);
const fail = (status: number, code: string, error: string, extra: Partial<Extract<AdminResult<never>, { ok: false }>> = {}) =>
  ({ ok: false as const, status, code, error, ...extra });

export function newCampaignId(): string {
  return `cmp_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;
}

export async function ensureCampaignIndexes(db: Db): Promise<void> {
  await Promise.all([
    col(db).createIndex({ status: 1, updatedAt: -1 }),
    col(db).createIndex({ scheduledAt: 1 }, { sparse: true }),
  ]).catch((e) => console.warn("[shopCampaigns] ensureCampaignIndexes:", e?.message || e));
}

async function audit(db: Db, campaignId: string, action: string, actor: string, extra: Record<string, unknown> = {}) {
  await db.collection(PROMOTION_AUDIT_COL).insertOne({
    id: `aud_${Date.now()}_${randomUUID().slice(0, 6)}`,
    promotionId: campaignId,
    entity: "campaign",
    action,
    actor,
    ...extra,
    createdAt: new Date().toISOString(),
  });
}

/** Báo mọi tiến trình bỏ cache `current` và phát SSE `campaign`. */
function announceChange(id: string, source: string) {
  clearCurrentCampaignCache();
  syncBus.publish(CAMPAIGNS_COL, source, { ids: [id] });
}

export async function listCampaigns(db: Db, includeArchived: boolean): Promise<CampaignDoc[]> {
  const filter = includeArchived ? {} : { status: { $ne: "archived" as const } };
  return col(db).find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
}

export async function getCampaign(db: Db, id: string): Promise<CampaignDoc | null> {
  return col(db).findOne({ _id: id });
}

export async function createCampaign(db: Db, content: CampaignContent, actor: string, preset?: string): Promise<CampaignDoc> {
  const nowIso = new Date().toISOString();
  const doc: CampaignDoc = {
    _id: newCampaignId(),
    draft: content,
    published: null,
    revision: 1,
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    preset,
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedBy: actor,
  };
  await col(db).insertOne(doc);
  await audit(db, doc._id, "campaign_create", actor, { preset });
  return doc;
}

/** Cập nhật có điều kiện theo `revision`; phân biệt 404 và 409 khi không khớp. */
async function updateAtRevision(
  db: Db,
  id: string,
  revision: number,
  set: Partial<CampaignDoc>,
  actor: string
): Promise<AdminResult<CampaignDoc>> {
  const updated = await col(db).findOneAndUpdate(
    { _id: id, revision },
    { $set: { ...set, updatedAt: new Date().toISOString(), updatedBy: actor }, $inc: { revision: 1 } },
    { returnDocument: "after" }
  );
  if (updated) return { ok: true, value: updated };
  const exists = await col(db).countDocuments({ _id: id }, { limit: 1 });
  return exists ? fail(409, "revision_conflict", M.revisionConflict) : fail(404, "not_found", M.notFound);
}

/** Phần tiền bạc / số lượng / lịch chạy: nhân viên không được đổi. */
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v).filter((k) => (v as any)[k] !== undefined).sort().map((k) => `${k}:${stable((v as any)[k])}`).join(",")}}`
      : JSON.stringify(v ?? null);
const moneyPart = (c: CampaignContent) =>
  stable([c.products, c.slots, c.voucherIds, c.info.startAt, c.info.endAt, c.info.testOnly]);

export async function saveDraft(
  db: Db,
  id: string,
  input: unknown,
  revision: number,
  actor: string,
  isManager = true
): Promise<AdminResult<CampaignDoc>> {
  const v = validateCampaignContent(input);
  if (isInvalidCampaign(v)) return fail(400, "invalid", M.invalid, { fields: v.fields });
  if (!isManager) {
    const cur = await getCampaign(db, id);
    if (!cur) return fail(404, "not_found", M.notFound);
    if (moneyPart(cur.draft) !== moneyPart(v.value)) return fail(403, "manager_only", M.managerOnly);
  }
  const r = await updateAtRevision(db, id, revision, { draft: v.value }, actor);
  if (r.ok) await audit(db, id, "campaign_save_draft", actor);
  return r;
}

const overlaps = (a: CampaignContent, b: CampaignContent) =>
  Date.parse(a.info.startAt) < Date.parse(b.info.endAt) && Date.parse(b.info.startAt) < Date.parse(a.info.endAt);

/** Chiến dịch khác (đang bật hoặc tạm dừng) trùng thời gian — mỗi lúc chỉ chạy 1. */
export async function findOverlap(db: Db, id: string, content: CampaignContent): Promise<CampaignDoc | null> {
  const others = await col(db)
    .find({ _id: { $ne: id }, status: { $in: ["published", "paused"] }, published: { $ne: null } })
    .toArray();
  return others.find((o) => o.published && overlaps(o.published, content)) || null;
}

/** Lý do bắt buộc khi còn mục "confirm" (giá dưới vốn); lưu vào audit. */
export type PublishConfirm = { reason?: string } | null;
const validReason = (c: PublishConfirm) => String(c?.reason || "").trim().slice(0, 300);

async function checkPublishable(
  db: Db,
  doc: CampaignDoc,
  confirm: PublishConfirm
): Promise<AdminResult<{ content: CampaignContent; reason: string; confirmed: string[] }>> {
  const report = await runPrepublishChecks(db, doc);
  const errors = report.issues.filter((i) => i.level === "error");
  const fields = (list: typeof errors) => list.map((i) => ({ path: i.path, message: i.message }));
  if (errors.length || !report.content) return fail(400, "invalid", errors[0]?.message || M.invalid, { fields: fields(errors) });
  const clash = await findOverlap(db, doc._id, report.content);
  if (clash) return fail(409, "overlap", M.overlap(clash.published?.info.name || clash._id));
  const confirms = report.issues.filter((i) => i.level === "confirm");
  const reason = validReason(confirm);
  if (confirms.length && reason.length < 5) return fail(409, "needs_confirm", M.needsConfirm, { fields: fields(confirms) });
  return { ok: true, value: { content: report.content, reason, confirmed: confirms.map((i) => i.message) } };
}

export async function publishCampaign(
  db: Db,
  id: string,
  revision: number,
  actor: string,
  confirm: PublishConfirm = null
): Promise<AdminResult<CampaignDoc>> {
  const doc = await getCampaign(db, id);
  if (!doc) return fail(404, "not_found", M.notFound);
  if (doc.revision !== revision) return fail(409, "revision_conflict", M.revisionConflict);
  const ready = await checkPublishable(db, doc, confirm);
  if (!ready.ok) return ready as AdminResult<never>;
  const { content, reason, confirmed } = ready.value;
  const status = doc.status === "paused" ? "paused" : "published";
  const r = await updateAtRevision(
    db,
    id,
    revision,
    { published: content, draft: content, status, publishedAt: new Date().toISOString(), scheduledAt: null, scheduleConfirm: null },
    actor
  );
  if (!r.ok) return r;
  await audit(db, id, "campaign_publish", actor, {
    before: doc.published,
    after: content,
    ...(confirmed.length ? { reason, confirmed } : {}),
  });
  announceChange(id, "campaign_publish");
  return r;
}

export async function discardDraft(db: Db, id: string, revision: number, actor: string): Promise<AdminResult<CampaignDoc>> {
  const doc = await getCampaign(db, id);
  if (!doc) return fail(404, "not_found", M.notFound);
  if (!doc.published) return fail(400, "not_published", M.nothingPublished);
  const r = await updateAtRevision(db, id, revision, { draft: doc.published }, actor);
  if (r.ok) await audit(db, id, "campaign_discard_draft", actor);
  return r;
}

export async function setCampaignPaused(db: Db, id: string, paused: boolean, actor: string): Promise<AdminResult<CampaignDoc>> {
  const from = paused ? "published" : "paused";
  const updated = await col(db).findOneAndUpdate(
    { _id: id, status: from, published: { $ne: null } },
    { $set: { status: paused ? "paused" : "published", updatedAt: new Date().toISOString(), updatedBy: actor }, $inc: { revision: 1 } },
    { returnDocument: "after" }
  );
  if (!updated) {
    const doc = await getCampaign(db, id);
    if (!doc) return fail(404, "not_found", M.notFound);
    if (!doc.published) return fail(400, "not_published", M.nothingPublished);
    return { ok: true, value: doc };
  }
  await audit(db, id, paused ? "campaign_pause" : "campaign_resume", actor);
  announceChange(id, paused ? "campaign_pause" : "campaign_resume");
  return { ok: true, value: updated };
}

export async function scheduleCampaign(
  db: Db,
  id: string,
  revision: number,
  atIso: string | null,
  actor: string,
  confirm: PublishConfirm = null
): Promise<AdminResult<CampaignDoc>> {
  const doc = await getCampaign(db, id);
  if (!doc) return fail(404, "not_found", M.notFound);
  let reason = "";
  if (atIso) {
    const at = Date.parse(atIso);
    if (!Number.isFinite(at) || at <= Date.now()) return fail(400, "schedule_in_past", M.scheduleInPast);
    const ready = await checkPublishable(db, doc, confirm);
    if (!ready.ok) return ready as AdminResult<never>;
    reason = ready.value.confirmed.length ? ready.value.reason : "";
  }
  const scheduledAt = atIso ? new Date(atIso).toISOString() : null;
  // Xác nhận chỉ gắn với đúng bản đã kiểm tra: sửa nháp sau đó thì worker phải kiểm tra lại từ đầu.
  const scheduleConfirm = reason ? { revision: revision + 1, reason } : null;
  const r = await updateAtRevision(db, id, revision, { scheduledAt, scheduleConfirm }, actor);
  if (r.ok) await audit(db, id, scheduledAt ? "campaign_schedule" : "campaign_unschedule", actor, { scheduledAt, ...(reason ? { reason } : {}) });
  return r;
}

/**
 * Áp dụng các chiến dịch đến giờ hẹn. Mỗi lịch chỉ một tiến trình "giành" được
 * nhờ update có điều kiện trên `scheduledAt`, nên áp dụng đúng 1 lần.
 */
export async function applyDueSchedules(db: Db, nowMs: number): Promise<string[]> {
  const due = await col(db)
    .find({ scheduledAt: { $ne: null, $lte: new Date(nowMs).toISOString() } })
    .limit(20)
    .toArray();
  const applied: string[] = [];
  for (const d of due) {
    const won = await col(db).findOneAndUpdate(
      { _id: d._id, scheduledAt: d.scheduledAt },
      { $set: { scheduledAt: null } },
      { returnDocument: "after" }
    );
    if (!won) continue;
    const confirm = won.scheduleConfirm?.revision === won.revision ? { reason: won.scheduleConfirm.reason } : null;
    const r = await publishCampaign(db, d._id, won.revision, "worker:schedule", confirm);
    if (r.ok) applied.push(d._id);
    else await audit(db, d._id, "campaign_schedule_failed", "worker:schedule", { error: (r as { error: string }).error });
  }
  return applied;
}

export async function archiveCampaign(db: Db, id: string, actor: string): Promise<AdminResult<CampaignDoc>> {
  const updated = await col(db).findOneAndUpdate(
    { _id: id },
    { $set: { status: "archived", scheduledAt: null, updatedAt: new Date().toISOString(), updatedBy: actor }, $inc: { revision: 1 } },
    { returnDocument: "after" }
  );
  if (!updated) return fail(404, "not_found", M.notFound);
  await audit(db, id, "campaign_archive", actor);
  announceChange(id, "campaign_archive");
  return { ok: true, value: updated };
}

/** Chỉ xoá bản nháp chưa từng bật và chưa có đơn; còn lại dùng "Lưu trữ". */
export async function deleteCampaign(db: Db, id: string, actor: string): Promise<AdminResult<true>> {
  const doc = await getCampaign(db, id);
  if (!doc) return fail(404, "not_found", M.notFound);
  if (doc.hasOrders) return fail(400, "has_orders", M.hasOrders);
  const r = await col(db).deleteOne({ _id: id, published: null, hasOrders: { $ne: true } });
  if (!r.deletedCount) return fail(400, "only_draft_delete", M.onlyDraftDelete);
  await audit(db, id, "campaign_delete", actor, { before: doc.draft });
  return { ok: true, value: true };
}

/** Nhân bản thành bản nháp mới: xoá ngày, voucher chỉ tham chiếu. */
export async function duplicateCampaign(db: Db, id: string, actor: string): Promise<AdminResult<CampaignDoc>> {
  const doc = await getCampaign(db, id);
  if (!doc) return fail(404, "not_found", M.notFound);
  const src = structuredClone(doc.draft);
  const content: CampaignContent = {
    ...src,
    info: { ...src.info, name: `${src.info.name} (Bản sao)`, slug: `${src.info.slug}-copy`.slice(0, 60), startAt: "", endAt: "" },
  };
  const copy = await createCampaign(db, content, actor, doc.preset);
  await audit(db, copy._id, "campaign_duplicate", actor, { from: id });
  return { ok: true, value: copy };
}
