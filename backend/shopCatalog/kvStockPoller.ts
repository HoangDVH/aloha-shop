/**
 * Poll tồn/giá từ KiotViet → chỉ $set field ĐÃ CÓ trên aloha_shop_db.aloha_products.
 * Không thêm thuộc tính mới (inventories, kvTon, source, …) — ngoại lệ duy nhất: isActive
 * (SP bị xoá / ngừng kinh doanh trên KV, xem kvActiveSync).
 */
import type { Db, AnyBulkWriteOperation } from "mongodb";
import {
  fetchKvAccessToken,
  fetchKvProducts,
  loadKvCreds,
} from "../services/kvApiClient.js";
import { sumInventoriesOnHand } from "../utils/productTon.js";
import { syncBus } from "../syncBus.js";
import { planKvActiveChanges, type KvActiveDoc } from "./kvActiveSync.js";
import { resolveShopKvBranchId } from "../shopOrders/kvPush.js";

const STATE_COL = "aloha_shop_sync_state";
const SYNC_KEY = "kv_stock";
const PRODUCT_COL = "aloha_products";
const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;
/** Full = quét toàn bộ KV: phát hiện SP bị xoá (API delta không trả mã đã xoá). */
const FULL_SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
const INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const BACKOFF_CAP_MS = 15 * 60 * 1000;

/** Field được phép cập nhật nếu document shop đã có key đó. */
const PATCHABLE = [
  "ton",
  "onHand",
  "gia",
  "giaBan",
  "giaChung",
  "giaWeb",
  "basePrice",
  "updatedAt",
] as const;

type PatchableKey = (typeof PATCHABLE)[number];

export type KvStockPollResult = {
  ok: boolean;
  at: string;
  fetched: number;
  matched: number;
  updated: number;
  skipped: number;
  /** isActive=false vì KV ngừng kinh doanh / đã xoá; true vì KV bán lại. */
  deactivated?: number;
  reactivated?: number;
  /** Mã vắng trên KV nhưng không ẩn vì danh sách KV nghi thiếu. */
  blockedDeletes?: number;
  deltaFrom: string | null;
  fullSync: boolean;
  durationMs: number;
  error?: string;
};

type SyncStateDoc = {
  key: string;
  lastAt?: string;
  lastModifiedFrom?: string;
  lastFullSyncAt?: string;
  lastRun?: KvStockPollResult;
};

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let failStreak = 0;

function nowIso() {
  return new Date().toISOString();
}

export function isShopKvStockPollEnabled(): boolean {
  const v = String(process.env.SHOP_KV_STOCK_POLL ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

function pollIntervalMs(): number {
  const n = Number(process.env.SHOP_KV_STOCK_POLL_MS);
  return Number.isFinite(n) && n >= 60_000 ? n : DEFAULT_INTERVAL_MS;
}

function normMa(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

function hasOwn(doc: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(doc, key);
}

/**
 * Tồn KV cho shop: chi nhánh bán web (branchId, cùng CN đẩy đơn) nếu có trong inventories;
 * không thì số cấp SP / tổng inventories.
 */
export function tonFromKvProduct(p: Record<string, unknown>, branchId = 0): number {
  const inv = Array.isArray(p.inventories) ? (p.inventories as Array<Record<string, unknown>>) : [];
  if (branchId > 0) {
    const row = inv.find((x) => Number(x?.branchId) === branchId);
    if (row) return Number(row.onHand) || 0;
  }
  const direct = p.onHand ?? p.OnHand ?? p.ton ?? p.tonKho;
  if (direct != null && direct !== "") {
    const n = Number(direct);
    if (Number.isFinite(n)) return n;
  }
  if (inv.length) return sumInventoriesOnHand(inv as any);
  return 0;
}

function priceFromKv(p: Record<string, unknown>): Partial<Record<PatchableKey, number>> {
  const base = Number(p.basePrice ?? p.BasePrice ?? 0) || 0;
  const out: Partial<Record<PatchableKey, number>> = {};
  if (base > 0) {
    out.gia = base;
    out.giaBan = base;
    out.giaChung = base;
    out.basePrice = base;
  }
  // priceBooks: lấy web nếu có
  const books = Array.isArray(p.priceBooks) ? p.priceBooks : [];
  for (const b of books as any[]) {
    const name = String(b?.priceBookName || b?.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const price = Number(b?.price ?? 0) || 0;
    if (price <= 0) continue;
    if (name.includes("web") || name.replace(/\s+/g, "") === "giaweb") {
      out.giaWeb = price;
    }
  }
  return out;
}

/** branchId = 0 (không xác định được CN bán web) → không ghi tồn, tránh ghi tổng mọi kho. */
function buildSetForShopDoc(
  shopDoc: Record<string, unknown>,
  kv: Record<string, unknown>,
  branchId: number
): Record<string, unknown> | null {
  const ton = branchId > 0 ? tonFromKvProduct(kv, branchId) : undefined;
  const candidate: Partial<Record<PatchableKey, unknown>> = {
    ton,
    onHand: ton,
    ...priceFromKv(kv),
    updatedAt: nowIso(),
  };

  const $set: Record<string, unknown> = {};
  for (const key of PATCHABLE) {
    if (!hasOwn(shopDoc, key)) continue;
    if (candidate[key] === undefined) continue;
    $set[key] = candidate[key];
  }
  // CMS videos are never owned by KV stock sync (fail-closed).
  delete $set.videos;
  delete $set.videoUrl;
  return Object.keys($set).length ? $set : null;
}

async function readState(db: Db): Promise<SyncStateDoc | null> {
  const doc = await db.collection(STATE_COL).findOne({ key: SYNC_KEY });
  if (!doc) return null;
  const { _id, ...rest } = doc as SyncStateDoc & { _id?: unknown };
  return rest;
}

async function writeState(db: Db, patch: Partial<SyncStateDoc>) {
  await db.collection(STATE_COL).updateOne(
    { key: SYNC_KEY },
    { $set: { key: SYNC_KEY, ...patch } },
    { upsert: true }
  );
}

function computeDeltaFrom(
  state: SyncStateDoc | null,
  forceFull: boolean
): { lastModifiedFrom: string | null; fullSync: boolean } {
  if (forceFull) return { lastModifiedFrom: null, fullSync: true };
  const lastFull = state?.lastFullSyncAt ? Date.parse(state.lastFullSyncAt) : 0;
  const needFull =
    !state?.lastAt || !lastFull || Date.now() - lastFull >= FULL_SYNC_EVERY_MS;
  if (needFull) return { lastModifiedFrom: null, fullSync: true };
  const from =
    state?.lastModifiedFrom ||
    state?.lastAt ||
    new Date(Date.now() - INITIAL_LOOKBACK_MS).toISOString();
  return { lastModifiedFrom: from, fullSync: false };
}

export async function runShopKvStockPoll(
  getDb: () => Promise<Db>,
  opts?: { forceFull?: boolean; source?: string }
): Promise<KvStockPollResult> {
  if (running) {
    return {
      ok: false,
      at: nowIso(),
      fetched: 0,
      matched: 0,
      updated: 0,
      skipped: 0,
      deltaFrom: null,
      fullSync: false,
      durationMs: 0,
      error: "poll_already_running",
    };
  }
  running = true;
  const t0 = Date.now();
  const at = nowIso();
  try {
    const db = await getDb();
    const creds = await loadKvCreds(db);
    if (!creds) {
      throw new Error(
        "Thiếu cấu hình KiotViet (KV_* env hoặc config/kiotviet trong Mongo)"
      );
    }
    const state = await readState(db);
    const { lastModifiedFrom, fullSync } = computeDeltaFrom(
      state,
      !!opts?.forceFull
    );
    const token = await fetchKvAccessToken(creds);
    const branchId = await resolveShopKvBranchId(creds, token).catch((e: any) => {
      console.warn("[kv-stock-poll] không xác định được CN bán web — bỏ qua cập nhật tồn:", e?.message || e);
      return 0;
    });
    const raw = await fetchKvProducts(creds, token, { lastModifiedFrom });

    const byMa = new Map<string, Record<string, unknown>>();
    const rawCodes = new Set<string>();
    for (const p of raw) {
      const code = String((p as any)?.code ?? (p as any)?.Code ?? (p as any)?.ma ?? "").trim();
      const ma = normMa(code);
      if (!ma) continue;
      byMa.set(ma, p as Record<string, unknown>);
      rawCodes.add(code);
    }

    let matched = 0;
    let updated = 0;
    let skipped = 0;
    let deactivated = 0;
    let reactivated = 0;
    let blockedDeletes = 0;
    const changedIds: string[] = [];

    if (byMa.size) {
      // Mã KV giữ nguyên hoa/thường («50k») — doc shop có thể lưu mã gốc hoặc mã HOA.
      const mas = [...new Set([...byMa.keys(), ...rawCodes])];
      // Full: lấy hết SP shop để tìm mã đã bị xoá trên KV.
      const shopDocs = await db
        .collection(PRODUCT_COL)
        .find(fullSync ? { mergedInto: { $exists: false } } : { ma: { $in: mas }, mergedInto: { $exists: false } })
        .project({
          ma: 1,
          ton: 1,
          onHand: 1,
          gia: 1,
          giaBan: 1,
          giaChung: 1,
          giaWeb: 1,
          basePrice: 1,
          updatedAt: 1,
          isActive: 1,
        })
        .toArray();

      const ops: AnyBulkWriteOperation[] = [];
      const plan = planKvActiveChanges(shopDocs as KvActiveDoc[], raw, { full: fullSync });
      blockedDeletes = plan.blockedDeletes;
      for (const c of plan.changes) {
        ops.push({ updateOne: { filter: { _id: c._id as any }, update: { $set: { isActive: c.isActive } } } });
        if (c.isActive) reactivated += 1;
        else deactivated += 1;
        changedIds.push(c.ma);
      }
      if (plan.changes.length || blockedDeletes) {
        console.log(
          `[kv-stock-poll] isActive: an=${deactivated} mo_lai=${reactivated} chan_an=${blockedDeletes}` +
            (plan.changes.length ? ` (${plan.changes.slice(0, 20).map((c) => `${c.ma}:${c.reason}`).join(",")})` : "")
        );
      }
      for (const doc of shopDocs) {
        const ma = normMa((doc as any).ma);
        const kv = byMa.get(ma);
        if (!kv) continue;
        matched += 1;
        const $set = buildSetForShopDoc(doc as Record<string, unknown>, kv, branchId);
        if (!$set) {
          skipped += 1;
          continue;
        }
        // Chỉ ghi nếu có thay đổi thực sự (tránh bump updatedAt vô ích)
        let changed = false;
        for (const [k, v] of Object.entries($set)) {
          if (k === "updatedAt") continue;
          const prev = (doc as any)[k];
          if (Number(prev) !== Number(v) && prev !== v) {
            changed = true;
            break;
          }
        }
        if (!changed) {
          skipped += 1;
          continue;
        }
        ops.push({
          updateOne: {
            filter: { _id: (doc as any)._id },
            update: { $set },
          },
        });
        changedIds.push(ma);
      }

      if (ops.length) {
        const CHUNK = 200;
        for (let i = 0; i < ops.length; i += CHUNK) {
          const slice = ops.slice(i, i + CHUNK);
          const r = await db.collection(PRODUCT_COL).bulkWrite(slice, {
            ordered: false,
          });
          updated += r.modifiedCount + r.upsertedCount;
        }
      }
    }

    if (changedIds.length) {
      syncBus.publish(["aloha_products"], opts?.source || "kv-stock-poll", {
        ids: changedIds.slice(0, 200),
      });
    }

    const result: KvStockPollResult = {
      ok: true,
      at,
      fetched: raw.length,
      matched,
      updated,
      skipped,
      deactivated,
      reactivated,
      blockedDeletes,
      deltaFrom: lastModifiedFrom,
      fullSync,
      durationMs: Date.now() - t0,
    };
    await writeState(db, {
      lastAt: at,
      lastModifiedFrom: at,
      ...(fullSync ? { lastFullSyncAt: at } : {}),
      lastRun: result,
    });
    failStreak = 0;
    console.log(
      `[kv-stock-poll] ${fullSync ? "FULL" : "DELTA"} updated=${updated} matched=${matched} skip=${skipped} fetched=${raw.length} (${result.durationMs}ms)`
    );
    return result;
  } catch (e: any) {
    failStreak += 1;
    const result: KvStockPollResult = {
      ok: false,
      at,
      fetched: 0,
      matched: 0,
      updated: 0,
      skipped: 0,
      deltaFrom: null,
      fullSync: false,
      durationMs: Date.now() - t0,
      error: e?.message || String(e),
    };
    console.warn("[kv-stock-poll] lỗi:", result.error);
    try {
      const db = await getDb();
      await writeState(db, { lastRun: result });
    } catch {
      /* ignore */
    }
    return result;
  } finally {
    running = false;
  }
}

function nextDelayMs(): number {
  const base = pollIntervalMs();
  if (failStreak <= 0) return base;
  return Math.min(BACKOFF_CAP_MS, base * Math.min(failStreak, 4));
}

function scheduleNext(getDb: () => Promise<Db>) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void runShopKvStockPoll(getDb).finally(() => scheduleNext(getDb));
  }, nextDelayMs());
}

/** Bật poller nền (full sync lần đầu nếu chưa có state). */
export function startShopKvStockPoller(getDb: () => Promise<Db>): void {
  if (!isShopKvStockPollEnabled()) {
    console.log("[kv-stock-poll] tắt (SHOP_KV_STOCK_POLL=0)");
    return;
  }
  console.log(
    `[kv-stock-poll] bật — chu kỳ ~${Math.round(pollIntervalMs() / 1000)}s`
  );
  // Chạy sớm sau boot (full nếu chưa sync), rồi lặp
  void (async () => {
    try {
      const db = await getDb();
      const state = await readState(db);
      await runShopKvStockPoll(getDb, {
        forceFull: !state?.lastAt,
        source: "kv-stock-poll-boot",
      });
    } catch (e: any) {
      console.warn("[kv-stock-poll] boot:", e?.message || e);
    } finally {
      scheduleNext(getDb);
    }
  })();
}
