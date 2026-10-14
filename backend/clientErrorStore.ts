import type { Db } from "mongodb";
import { statfs } from "node:fs/promises";

export const CLIENT_ERRORS = "aloha_client_errors";
const pending = new WeakMap<Db, Promise<unknown>>();
export async function ensureClientErrorIndexes(db: Db) {
  let promise = pending.get(db);
  if (!promise) {
    promise = db.collection(CLIENT_ERRORS).createIndexes([
      { key: { at: -1 }, name: "recent_client_errors" },
      { key: { expiresAt: 1 }, name: "client_errors_ttl", expireAfterSeconds: 0 },
    ]).catch(error => { pending.delete(db); throw error; });
    pending.set(db, promise);
  }
  await promise;
}
export async function recordClientError(db: Db, report: Record<string, unknown>) {
  await ensureClientErrorIndexes(db);
  const at = new Date();
  await db.collection(CLIENT_ERRORS).insertOne({ ...report, at, expiresAt: new Date(at.getTime() + 7 * 86400_000) });
}
export function diskSeverity(usedPercent: number) {
  return usedPercent >= 90 ? "critical" : usedPercent >= 80 ? "warning" : "ok";
}
export async function siteHealth(db: Db) {
  await ensureClientErrorIndexes(db);
  const now = new Date();
  const collection = db.collection(CLIENT_ERRORS);
  const [recentCount, dayCount, latest, disk] = await Promise.all([
    collection.countDocuments({ at: { $gte: new Date(now.getTime() - 15 * 60_000) } }),
    collection.countDocuments({ at: { $gte: new Date(now.getTime() - 86400_000) } }),
    collection.find({}, { projection: { expiresAt: 0 } }).sort({ at: -1 }).limit(20).toArray(),
    statfs(process.cwd()),
  ]);
  const totalBytes = disk.blocks * disk.bsize;
  const freeBytes = disk.bavail * disk.bsize;
  const usedPercent = Math.round(100 * (totalBytes - freeBytes) / Math.max(1, totalBytes));
  return { updatedAt: now.toISOString(), recentCount, dayCount, latest,
    errorAlert: recentCount >= 5, disk: { totalBytes, freeBytes, usedPercent, status: diskSeverity(usedPercent) } };
}
