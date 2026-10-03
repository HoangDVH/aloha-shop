/**
 * NV sửa Đặt hàng trên KiotViet (phí ship, SL, giá, giảm giá) → đơn web tự cập nhật.
 * - Webhook order.update → /api/kv-webhook/orders (nhanh, có thể sót).
 * - Đối soát định kỳ: 1 lần GET /orders?lastModifiedFrom (bù khi webhook sót/không bắn).
 * Không tin body webhook — luôn đọc lại đơn từ API KV trong syncShopOrderMoneyFromKv.
 */
import type { Express, Request, Response } from "express";
import type { Db } from "mongodb";
import { fetchKvAccessToken, kvApiBase, loadKvCreds } from "../services/kvApiClient.js";
import { SHOP_ORDERS } from "./models.js";
import { findShopOrderByKvOrderId } from "./findShopOrder.js";
import { syncShopOrderMoneyFromKv } from "./kvOrderMoneySync.js";
import { flattenInvoiceNotifications, verifyKvWebhookSignature } from "./kvInvoiceWebhook.js";

type GetDb = () => Promise<Db>;

const STATE_COL = "aloha_shop_sync_state";
const STATE_ID = "kv_order_edit";
const DEFAULT_INTERVAL_MS = 3 * 60 * 1000;
const OVERLAP_MS = 2 * 60 * 1000;
const INITIAL_LOOKBACK_MS = 30 * 60 * 1000;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_WEBHOOK_IDS = 50;
const OPEN_EXCLUDED = ["hoan_thanh", "huy"];

export function isKvOrderEditSyncEnabled(): boolean {
  const v = String(process.env.SHOP_KV_ORDER_SYNC ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

function intervalMs(): number {
  const n = Number(process.env.SHOP_KV_ORDER_SYNC_MS);
  return Number.isFinite(n) && n >= 60_000 ? n : DEFAULT_INTERVAL_MS;
}

/** Id đơn KV trong payload webhook order.update (Notifications[].Data[].Id). */
export function kvOrderIdsFromWebhook(body: unknown): string[] {
  const ids = new Set<string>();
  for (const o of flattenInvoiceNotifications(body)) {
    const id = o?.Id ?? o?.id ?? o?.OrderId;
    if (id != null && String(id).trim()) ids.add(String(id).trim());
    if (ids.size >= MAX_WEBHOOK_IDS) break;
  }
  return [...ids];
}

const inFlight = new Set<string>();
const rerun = new Set<string>();

/** Chạy nền, gộp các thông báo trùng đơn đang xử lý thành 1 lần chạy lại. */
function queueSync(getShopDb: GetDb, getMainDb: GetDb, kvOrderId: string) {
  if (inFlight.has(kvOrderId)) {
    rerun.add(kvOrderId);
    return;
  }
  inFlight.add(kvOrderId);
  void (async () => {
    try {
      do {
        rerun.delete(kvOrderId);
        const shopDb = await getShopDb();
        const order = await findShopOrderByKvOrderId(shopDb, kvOrderId);
        if (!order) return;
        const r = await syncShopOrderMoneyFromKv({
          shopDb,
          mainDb: await getMainDb(),
          kvOrderId,
          source: "webhook",
        });
        if (r.changed || r.conflict || r.error) console.log("[kv-order-edit] webhook", kvOrderId, r);
      } while (rerun.has(kvOrderId));
    } catch (e: any) {
      console.warn("[kv-order-edit] webhook sync", kvOrderId, e?.message || e);
    } finally {
      inFlight.delete(kvOrderId);
      rerun.delete(kvOrderId);
    }
  })();
}

export function registerKvOrderWebhookRoutes(app: Express, getShopDb: GetDb, getMainDb: GetDb) {
  // KV ngừng gửi nếu nhận 4xx hoặc quá 5s — luôn trả 200 ngay, xử lý nền.
  app.post("/api/kv-webhook/orders", (req: Request, res: Response) => {
    try {
      const sigOk = verifyKvWebhookSignature(req);
      const ids = kvOrderIdsFromWebhook(req.body || {});
      for (const id of ids) queueSync(getShopDb, getMainDb, id);
      return res.status(200).json({ ok: true, queued: ids.length, sigOk });
    } catch (e: any) {
      console.error("[kv-webhook/orders]", e);
      return res.status(200).json({ ok: false, error: e?.message || "webhook_failed" });
    }
  });
}

/** Lease Mongo — nhiều tiến trình backend chỉ 1 tiến trình gọi KV mỗi chu kỳ. */
async function acquireLease(db: Db, ms: number): Promise<boolean> {
  const now = new Date();
  try {
    const r = await db.collection(STATE_COL).findOneAndUpdate(
      { _id: STATE_ID as any, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }] },
      { $set: { leaseUntil: new Date(now.getTime() + ms) } },
      { upsert: true, returnDocument: "after" }
    );
    return Boolean(r);
  } catch (e: any) {
    if (e?.code === 11000) return false;
    throw e;
  }
}

async function fetchKvOrdersModifiedSince(mainDb: Db, since: string): Promise<{ orders: any[]; truncated: boolean }> {
  const creds = await loadKvCreds(mainDb);
  if (!creds) throw new Error("Chưa cấu hình KiotViet");
  const token = await fetchKvAccessToken(creds);
  const headers = { Authorization: `Bearer ${token}`, Retailer: creds.retailer };
  const out: any[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${kvApiBase()}/orders?pageSize=${PAGE_SIZE}&currentItem=${page * PAGE_SIZE}` +
      `&includeOrderDelivery=true&lastModifiedFrom=${encodeURIComponent(since)}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`KV /orders HTTP ${res.status}`);
    const json: any = await res.json().catch(() => null);
    const data = Array.isArray(json?.data) ? json.data : [];
    out.push(...data);
    if (data.length < PAGE_SIZE) return { orders: out, truncated: false };
  }
  return { orders: out, truncated: true };
}

export type KvOrderEditTickResult = {
  ran: boolean;
  fetched?: number;
  matched?: number;
  changed?: number;
  conflicts?: number;
  error?: string;
};

export async function runKvOrderEditSyncTick(getShopDb: GetDb, getMainDb: GetDb): Promise<KvOrderEditTickResult> {
  const shopDb = await getShopDb();
  const ms = intervalMs();
  if (!(await acquireLease(shopDb, Math.max(60_000, ms - 10_000)))) return { ran: false };

  const tickStart = Date.now();
  const state = await shopDb.collection(STATE_COL).findOne({ _id: STATE_ID as any });
  const since = String(state?.lastModifiedFrom || new Date(tickStart - INITIAL_LOOKBACK_MS).toISOString());

  // Không có đơn web mở trên KV thì không tốn request KV.
  const openCount = await shopDb.collection(SHOP_ORDERS).countDocuments(
    { kvOrderId: { $nin: [null, ""] }, orderStatus: { $nin: OPEN_EXCLUDED } },
    { limit: 1 }
  );
  const nextCursor = new Date(tickStart - OVERLAP_MS).toISOString();
  if (!openCount) {
    await shopDb.collection(STATE_COL).updateOne({ _id: STATE_ID as any }, { $set: { lastModifiedFrom: nextCursor } });
    return { ran: true, fetched: 0 };
  }

  const mainDb = await getMainDb();
  const { orders, truncated } = await fetchKvOrdersModifiedSince(mainDb, since);
  if (truncated) console.warn(`[kv-order-edit] > ${MAX_PAGES * PAGE_SIZE} đơn KV sửa từ ${since}, phần dư bỏ qua`);

  const kvIds = orders.map((o) => o?.id ?? o?.Id).filter((id) => id != null);
  const idForms = kvIds.flatMap((id) => [Number(id), String(id)]);
  const webOrders = kvIds.length
    ? await shopDb
        .collection(SHOP_ORDERS)
        .find({ kvOrderId: { $in: idForms }, orderStatus: { $nin: OPEN_EXCLUDED } })
        .project({ code: 1, kvOrderId: 1 })
        .toArray()
    : [];
  const codeByKvId = new Map(webOrders.map((o) => [String(o.kvOrderId), String(o.code)]));

  let changed = 0;
  let conflicts = 0;
  for (const kvOrder of orders) {
    const kvOrderId = kvOrder?.id ?? kvOrder?.Id;
    const code = kvOrderId != null ? codeByKvId.get(String(kvOrderId)) : undefined;
    if (!code) continue;
    const hasDelivery = kvOrder.orderDelivery !== undefined || kvOrder.OrderDelivery !== undefined;
    const r = await syncShopOrderMoneyFromKv({
      shopDb,
      mainDb,
      orderRef: code,
      kvOrderId,
      kvOrder: hasDelivery && Array.isArray(kvOrder.orderDetails) ? kvOrder : undefined,
      source: "poll",
    });
    if (r.changed) changed++;
    if (r.conflict) conflicts++;
  }

  await shopDb.collection(STATE_COL).updateOne({ _id: STATE_ID as any }, { $set: { lastModifiedFrom: nextCursor } });
  return { ran: true, fetched: orders.length, matched: codeByKvId.size, changed, conflicts };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startKvOrderEditSync(getShopDb: GetDb, getMainDb: GetDb) {
  if (!isKvOrderEditSyncEnabled()) {
    console.log("[kv-order-edit] Tắt (SHOP_KV_ORDER_SYNC=0)");
    return;
  }
  const tick = () => {
    if (running) return;
    running = true;
    void runKvOrderEditSyncTick(getShopDb, getMainDb)
      .then((r) => {
        if (r.changed || r.conflicts) console.log("[kv-order-edit] tick", r);
      })
      .catch((e: any) => console.warn("[kv-order-edit] tick lỗi:", e?.message || e))
      .finally(() => {
        running = false;
      });
  };
  setTimeout(tick, 30_000);
  timer = setInterval(tick, intervalMs());
  console.log(`[kv-order-edit] Bật — đối soát sửa đơn KV mỗi ${Math.round(intervalMs() / 1000)}s`);
}

export function stopKvOrderEditSync() {
  if (timer) clearInterval(timer);
  timer = null;
}
