import type { Db } from "mongodb";
import { z } from "zod";
import { cacheCommand } from "../cache/transport.js";

export const VISITS = "aloha_shop_visits";
export const visitInput = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  path: z.string().max(1024).regex(/^\/(?!\/)/),
}).strict();
export const excludedPath = (path: string) => /^\/(admin|api|_next)(\/|$)/i.test(path);
export const isBot = (ua: string) => /bot|crawler|spider|headless|lighthouse|preview|facebookexternalhit/i.test(ua);

function dayStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10) === value ? date : null;
}

export function visitRange(from: unknown, to: unknown) {
  if (typeof from !== "string" || typeof to !== "string") return null;
  const start = dayStart(from), end = dayStart(to);
  if (!start || !end || end < start || end.getTime() - start.getTime() > 365 * 86400_000) return null;
  return { from, to, start, end: new Date(end.getTime() + 86400_000) };
}

const indexed = new WeakMap<Db, Promise<unknown>>();
export async function ensureVisitIndexes(db: Db) {
  let promise = indexed.get(db);
  if (!promise) {
    promise = db.collection(VISITS).createIndexes([
      { key: { sessionId: 1 }, unique: true, name: "visit_session_unique" },
      { key: { startedAt: 1, visitorId: 1 }, name: "visit_range_visitors" },
    ]).catch(error => { indexed.delete(db); throw error; });
    indexed.set(db, promise);
  }
  await promise;
}

export async function recordVisit(db: Db, input: z.infer<typeof visitInput>, now = new Date()) {
  await ensureVisitIndexes(db);
  const update = {
    $setOnInsert: { sessionId: input.sessionId, visitorId: input.visitorId, startedAt: now },
    $max: { lastSeenAt: now },
  };
  const filter = { sessionId: input.sessionId, visitorId: input.visitorId };
  try {
    await db.collection(VISITS).updateOne(filter, update, { upsert: true });
  } catch (error: any) {
    // Concurrent first requests share a session; another visitor cannot claim it.
    if (error?.code !== 11000) throw error;
    await db.collection(VISITS).updateOne(filter, { $max: { lastSeenAt: now } });
  }
}

export type VisitStats = { visits: number; visitors: number; trackingSince: string | null; updatedAt: string };
export type VisitStatsCache = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<unknown> };
const statsCache: VisitStatsCache = {
  get: key => cacheCommand(redis => redis.get(key)),
  set: (key, value) => cacheCommand(redis => redis.set(key, value, { EX: 60 })),
};
export async function visitStats(db: Db, range: NonNullable<ReturnType<typeof visitRange>>, cache = statsCache): Promise<VisitStats> {
  await ensureVisitIndexes(db);
  const key = `aloha:admin:visits:v1:${db.databaseName}:${range.from}:${range.to}`;
  const cached = await cache.get(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (typeof parsed.visits === "number" && typeof parsed.visitors === "number" && typeof parsed.updatedAt === "string") return parsed;
    } catch { /* Treat malformed cache as a miss. */ }
  }
  const collection = db.collection(VISITS);
  const [counts, first] = await Promise.all([
    collection.aggregate([
      { $match: { startedAt: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: "$visitorId", sessions: { $sum: 1 } } },
      { $group: { _id: null, visitors: { $sum: 1 }, visits: { $sum: "$sessions" } } },
    ]).toArray(),
    collection.findOne({}, { sort: { startedAt: 1 }, projection: { startedAt: 1 } }),
  ]);
  const stats: VisitStats = {
    visits: counts[0]?.visits || 0, visitors: counts[0]?.visitors || 0,
    trackingSince: first?.startedAt?.toISOString() || null, updatedAt: new Date().toISOString(),
  };
  await cache.set(key, JSON.stringify(stats));
  return stats;
}
