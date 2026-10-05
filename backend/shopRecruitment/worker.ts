import type { Db } from "mongodb";
import { APPLICATIONS_COL, type RecruitmentApplicationDoc } from "./types.js";
import { confirmationEmail, sendRecruitmentEmail } from "./mail.js";
import { deleteCv, listCvFilesOlderThan } from "./cvStorage.js";
import { recruitmentMailEnabled } from "./config.js";

const MAX_EMAIL_ATTEMPTS = 5;
const LEASE_MS = 2 * 60_000;
const ORPHAN_GRACE_MS = 6 * 3600_000;

function appsCol(db: Db) {
  return db.collection<RecruitmentApplicationDoc>(APPLICATIONS_COL);
}

/** Claim 1 email bằng lease atomic — nhiều process không gửi trùng cùng lúc. */
export async function processOneConfirmation(db: Db, now = new Date()): Promise<boolean> {
  const col = appsCol(db);
  const doc = await col.findOneAndUpdate(
    {
      $or: [
        { "confirmation.status": { $in: ["pending", "retry"] }, "confirmation.nextAttemptAt": { $lte: now } },
        { "confirmation.status": "processing", "confirmation.leaseUntil": { $lt: now } },
      ],
    } as any,
    {
      $set: {
        "confirmation.status": "processing",
        "confirmation.leaseUntil": new Date(now.getTime() + LEASE_MS),
      },
      $inc: { "confirmation.attempts": 1 },
    },
    {
      returnDocument: "after",
      projection: { submissionType: 1, interestedPosition: 1, publicCode: 1, contact: 1, confirmation: 1 },
    }
  );
  if (!doc?.confirmation) return false;

  const { subject, html } = confirmationEmail(doc);
  const r = await sendRecruitmentEmail({
    to: doc.contact.email,
    subject,
    html,
    idempotencyKey: doc.confirmation.messageKey,
  });
  const claimed = { _id: doc._id, "confirmation.status": "processing" } as any;
  if (r.ok === true) {
    await col.updateOne(claimed, {
      $set: { "confirmation.status": "sent", "confirmation.sentAt": new Date() },
      $unset: { "confirmation.leaseUntil": "", "confirmation.nextAttemptAt": "", "confirmation.lastErrorCode": "" },
    });
    return true;
  }
  const attempts = doc.confirmation.attempts;
  const giveUp = !r.retryable || attempts >= MAX_EMAIL_ATTEMPTS;
  await col.updateOne(claimed, {
    $set: giveUp
      ? { "confirmation.status": "failed", "confirmation.lastErrorCode": r.code }
      : {
          "confirmation.status": "retry",
          "confirmation.lastErrorCode": r.code,
          "confirmation.nextAttemptAt": new Date(Date.now() + 2 ** attempts * 60_000),
        },
    $unset: { "confirmation.leaseUntil": "", ...(giveUp ? { "confirmation.nextAttemptAt": "" } : {}) },
  });
  return true;
}

/** Hết hạn lưu: xóa file CV trước, rồi xóa hồ sơ. Lỗi file → giữ hồ sơ để lần sau thử lại. */
export async function purgeExpiredApplications(db: Db, now = new Date(), batch = 50): Promise<number> {
  const col = appsCol(db);
  const rows = await col
    .find({ retentionUntil: { $lte: now } }, { projection: { cv: 1 } })
    .limit(batch)
    .toArray();
  let deleted = 0;
  for (const row of rows) {
    try {
      if (row.cv?.storageKey) await deleteCv(row.cv.storageKey);
      const r = await col.deleteOne({ _id: row._id, retentionUntil: { $lte: now } });
      deleted += r.deletedCount;
    } catch (e: any) {
      console.warn("[recruitment] retention delete failed", String(row._id), e?.message);
    }
  }
  return deleted;
}

/** File CV không còn hồ sơ tham chiếu (tiến trình chết giữa chừng) — sau khoảng chờ an toàn. */
export async function cleanupOrphanCvFiles(db: Db): Promise<number> {
  const keys = await listCvFilesOlderThan(ORPHAN_GRACE_MS);
  let removed = 0;
  for (let i = 0; i < keys.length; i += 200) {
    const chunk = keys.slice(i, i + 200);
    const used = await appsCol(db)
      .find({ "cv.storageKey": { $in: chunk } } as any, { projection: { "cv.storageKey": 1 } })
      .toArray();
    const usedSet = new Set(used.map((u) => u.cv?.storageKey));
    for (const k of chunk) {
      if (usedSet.has(k)) continue;
      await deleteCv(k).catch(() => undefined);
      removed++;
    }
  }
  return removed;
}

export function startRecruitmentWorker(getShopDb: () => Promise<Db>) {
  if (process.env.RECRUITMENT_WORKER_ENABLED === "0") return;
  let mailRunning = false;
  let cleanupRunning = false;

  const mailTick = async () => {
    if (mailRunning || !recruitmentMailEnabled()) return;
    mailRunning = true;
    try {
      const db = await getShopDb();
      for (let i = 0; i < 20; i++) {
        if (!(await processOneConfirmation(db))) break;
      }
    } catch (e: any) {
      console.warn("[recruitment] mail tick failed", e?.message);
    } finally {
      mailRunning = false;
    }
  };

  const cleanupTick = async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      const db = await getShopDb();
      const purged = await purgeExpiredApplications(db);
      const orphans = await cleanupOrphanCvFiles(db);
      if (purged || orphans) console.log(`[recruitment] retention: ${purged} hồ sơ, ${orphans} file mồ côi`);
    } catch (e: any) {
      console.warn("[recruitment] cleanup tick failed", e?.message);
    } finally {
      cleanupRunning = false;
    }
  };

  const mailTimer = setInterval(() => void mailTick(), 30_000);
  const cleanupTimer = setInterval(() => void cleanupTick(), 3600_000);
  const initial = setTimeout(() => void cleanupTick(), 60_000);
  mailTimer.unref?.();
  cleanupTimer.unref?.();
  initial.unref?.();
  return () => {
    clearInterval(mailTimer);
    clearInterval(cleanupTimer);
    clearTimeout(initial);
  };
}
