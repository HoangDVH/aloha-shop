"use client";

import { create } from "zustand";
import { priceSessionGeneration } from "./priceSession";
import { useCart, type CartLine } from "./cart";
import { fetchServerCart, mergeServerCart, saveServerCart, type ServerCartResponse } from "./cartApi";

const META_KEY = "aloha-shop-cart-sync-meta";
const MERGE_KEY = "aloha-shop-cart-pending-merge-v1";
const LOCK_NAME = "aloha-shop-cart-sync-v1";
type Meta = { userId: string; serverUpdatedAt: string; revision?: number; completedMergeKey?: string };
type MergeIntent = { userId: string; key: string; lines: CartLine[] };
export const useCartSyncStatus = create<{ error: string }>(() => ({ error: "" }));
let activeUserId: string | null = null;
let syncedUserId: string | null = null;
let revision = 0; // Per-tab base version; never borrow another tab's newer version for PUT.
let acknowledgedSignature = "";
let syncPaused = false;
let applyingServer = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: { userId: string; generation: number; promise: Promise<void> } | null = null;
let pushInFlight: Promise<void> | null = null;
let pushAgain = false;

export function isCartSyncPaused() { return syncPaused || applyingServer; }
function read<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : null;
}
function report(error: unknown) {
  useCartSyncStatus.setState({ error: error instanceof Error ? error.message : "Chưa đồng bộ được giỏ hàng. Vui lòng thử lại." });
}
function valid(userId: string, generation: number) {
  return activeUserId === userId && generation === priceSessionGeneration();
}
function verifyResponse(response: ServerCartResponse, userId: string) {
  if (response.userId !== userId) throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.");
}
async function locked<T>(work: () => Promise<T>, required = false): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(LOCK_NAME, work);
  // localStorage leases are not atomic; do not create independent merge IDs across tabs.
  if (required) throw new Error("Chưa thể đồng bộ giỏ khách an toàn. Vui lòng mở shop bằng HTTPS trên trình duyệt mới và thử lại.");
  return work(); // Server version checks still protect ordinary PUTs.
}
function remember(response: ServerCartResponse, completedMergeKey?: string) {
  localStorage.setItem(META_KEY, JSON.stringify({ userId: response.userId,
    serverUpdatedAt: response.updatedAt, revision: response.revision, completedMergeKey } satisfies Meta));
  revision = response.revision;
  acknowledgedSignature = signature(response.lines);
}
function hydrate(response: ServerCartResponse, completedMergeKey?: string) {
  // Acknowledge before changing the persisted cart; keep pending intent until both succeed.
  remember(response, completedMergeKey);
  applyingServer = true;
  try { useCart.getState().replaceLines(response.lines); }
  finally { queueMicrotask(() => { applyingServer = false; }); }
}
function signature(lines: CartLine[]) {
  return JSON.stringify(lines.map(({ ma, qty, selected, lineNote, ctv }) => ({ ma, qty, selected, lineNote, ctv })).sort((a, b) => a.ma.localeCompare(b.ma)));
}
function applyLocalDelta(server: CartLine[], before: CartLine[], after: CartLine[]) {
  const result = new Map(server.map(line => [line.ma, { ...line }]));
  const old = new Map(before.map(line => [line.ma, line]));
  const current = new Map(after.map(line => [line.ma, line]));
  for (const ma of new Set([...old.keys(), ...current.keys()])) {
    const a = old.get(ma); const b = current.get(ma); const remote = result.get(ma);
    const delta = (b?.qty || 0) - (a?.qty || 0);
    if (delta || (b && (b.selected !== a?.selected || b.lineNote !== a?.lineNote || b.ctv !== a?.ctv))) {
      const qty = Math.max(0, (remote?.qty || 0) + delta);
      if (!qty) result.delete(ma);
      else result.set(ma, { ...(remote || b || a)!, qty,
        selected: b?.selected ?? remote?.selected ?? true, lineNote: b?.lineNote, ctv: b?.ctv });
    }
  }
  return [...result.values()];
}
async function pullOrMerge(userId: string, generation: number) {
  const meta = read<Meta>(META_KEY);
  const pending = read<MergeIntent>(MERGE_KEY);
  const before = useCart.getState().lines;
  let response = await fetchServerCart();
  if (!valid(userId, generation)) return;
  verifyResponse(response, userId);
  let intent = pending?.userId === userId ? pending : null;
  if (!intent && !meta && !pending && before.length) {
    intent = { userId, key: `${Date.now()}.${crypto.randomUUID()}`, lines: before };
    localStorage.setItem(MERGE_KEY, JSON.stringify(intent)); // Must succeed before POST.
  }
  if (intent) {
    response = await mergeServerCart(intent.lines, userId, intent.key);
    if (!valid(userId, generation)) return;
    verifyResponse(response, userId);
  }
  const after = useCart.getState().lines;
  // If the prior response was lost, local edits since that attempt are relative
  // to its immutable guest snapshot, not to the cart already merged on the server.
  const baseline = intent && (!meta || (meta.userId === userId && meta.completedMergeKey !== intent.key)) ? intent.lines : before;
  const changed = signature(baseline) !== signature(after);
  hydrate(response, intent?.key);
  if (intent) localStorage.removeItem(MERGE_KEY);
  syncedUserId = userId;
  useCartSyncStatus.setState({ error: "" });
  if (changed) {
    useCart.getState().replaceLines(applyLocalDelta(response.lines, baseline, after));
    pushAgain = true;
  }
}
export function syncCartForUser(userId: string): Promise<void> {
  const generation = priceSessionGeneration();
  activeUserId = userId;
  if (syncInFlight?.userId === userId && syncInFlight.generation === generation) return syncInFlight.promise;
  syncPaused = true;
  syncedUserId = null;
  const task = { userId, generation, promise: Promise.resolve() };
  // Defer so even synchronous storage failures run after syncInFlight is assigned.
  task.promise = Promise.resolve().then(async () => {
    try {
      const needsMerge = Boolean(read<MergeIntent>(MERGE_KEY)?.userId === userId || (!read<Meta>(META_KEY) && useCart.getState().lines.length));
      await locked(async () => { if (valid(userId, generation)) await pullOrMerge(userId, generation); }, needsMerge);
    } catch (error) {
      if (valid(userId, generation)) report(error);
      throw error;
    } finally {
      if (syncInFlight === task) {
        syncInFlight = null;
        syncPaused = false;
        if (pushAgain && syncedUserId === userId) scheduleCartPushToServer(userId);
      }
    }
  });
  syncInFlight = task;
  return task.promise;
}
export function scheduleCartPushToServer(userId: string) {
  if (isCartSyncPaused() || syncedUserId !== userId) return;
  if (signature(useCart.getState().lines) === acknowledgedSignature) return;
  if (pushTimer) clearTimeout(pushTimer);
  const generation = priceSessionGeneration();
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (valid(userId, generation)) void pushCartToServerNow(userId);
  }, 700);
}
export function pushCartToServerNow(userId: string): Promise<void> {
  if (isCartSyncPaused() || syncedUserId !== userId) return Promise.resolve();
  if (signature(useCart.getState().lines) === acknowledgedSignature && !pushInFlight) return Promise.resolve();
  pushAgain = true;
  if (pushInFlight) return pushInFlight;
  const generation = priceSessionGeneration();
  pushInFlight = Promise.resolve().then(async () => {
    try {
      while (pushAgain && valid(userId, generation)) {
        pushAgain = false;
        await locked(async () => {
          if (!valid(userId, generation)) return;
          const lines = useCart.getState().lines;
          try {
            const saved = await saveServerCart(lines, userId, revision);
            if (!valid(userId, generation)) return;
            verifyResponse(saved, userId);
            remember(saved);
            useCartSyncStatus.setState({ error: "" });
            if (signature(lines) !== signature(useCart.getState().lines)) pushAgain = true;
          } catch (error: any) {
            if (!valid(userId, generation)) return;
            if (error.code === "cart_conflict") {
              const latest = await fetchServerCart();
              if (!valid(userId, generation)) return;
              verifyResponse(latest, userId);
              hydrate(latest);
              pushAgain = false;
            }
            throw error;
          }
        });
      }
    } catch (error) {
      if (valid(userId, generation)) { pushAgain = false; report(error); }
    } finally {
      pushInFlight = null;
      if (pushAgain && activeUserId && syncedUserId === activeUserId) scheduleCartPushToServer(activeUserId);
    }
  });
  return pushInFlight;
}
export async function retryCartSync(userId: string) {
  if (syncedUserId === userId) {
    if (signature(useCart.getState().lines) === acknowledgedSignature) useCartSyncStatus.setState({ error: "" });
    else await pushCartToServerNow(userId);
  }
  else await syncCartForUser(userId);
}
export async function onShopUserChanged(userId: string | null): Promise<void> {
  activeUserId = userId;
  if (!userId) {
    const wasAccountCart = Boolean(syncedUserId || read<Meta>(META_KEY) || read<MergeIntent>(MERGE_KEY));
    syncedUserId = null;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    pushAgain = false;
    useCartSyncStatus.setState({ error: "" });
    if (wasAccountCart) {
      // Clear persisted lines before removing ownership/intent; a crash must not
      // turn an account cart into a new guest cart eligible for another merge.
      useCart.getState().clear();
      localStorage.removeItem(MERGE_KEY);
      localStorage.removeItem(META_KEY);
    }
    return;
  }
  if (syncedUserId !== userId) await syncCartForUser(userId);
}
