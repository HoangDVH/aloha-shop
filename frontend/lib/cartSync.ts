"use client";

import type { CartLine } from "./cart";
import { useCart } from "./cart";
import { fetchServerCart, mergeServerCart, saveServerCart } from "./cartApi";

const SYNC_META_KEY = "aloha-shop-cart-sync-meta";
const PUSH_DEBOUNCE_MS = 700;

let syncPaused = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;
let syncedUserId: string | null = null;

type CartSyncMeta = {
  userId: string;
  serverUpdatedAt: string;
};

export function isCartSyncPaused() {
  return syncPaused;
}

function normalizeLines(lines: CartLine[]): CartLine[] {
  return lines.map((l) => ({
    ...l,
    dvt: l.dvt || "Cái",
    selected: l.selected !== false,
  }));
}

function linesSignature(lines: CartLine[]): string {
  return JSON.stringify(
    [...lines]
      .map((l) => ({
        ma: l.ma,
        qty: l.qty,
        gia: l.gia,
        selected: l.selected !== false,
        ctv: l.ctv || "",
      }))
      .sort((a, b) => a.ma.localeCompare(b.ma))
  );
}

function readMeta(): CartSyncMeta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CartSyncMeta;
    if (!o?.userId || !o?.serverUpdatedAt) return null;
    return o;
  } catch {
    return null;
  }
}

function writeMeta(meta: CartSyncMeta) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function clearMeta() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SYNC_META_KEY);
  } catch {
    /* ignore */
  }
}

/** Tải giỏ từ server vào zustand — không gửi ngược lên server. */
export function hydrateCartFromServer(lines: CartLine[], userId?: string, updatedAt?: string) {
  syncPaused = true;
  useCart.getState().replaceLines(normalizeLines(lines));
  if (userId && updatedAt) {
    writeMeta({ userId, serverUpdatedAt: updatedAt });
  }
  queueMicrotask(() => {
    syncPaused = false;
  });
}

/** Đồng bộ lần đầu sau đăng nhập / mở app đã đăng nhập. */
async function pullOrMergeCart(userId: string): Promise<void> {
  const local = normalizeLines(useCart.getState().lines);
  const meta = readMeta();
  syncPaused = true;

  try {
    const serverRes = await fetchServerCart();

    // Đổi tài khoản (meta còn userId khác) → lấy đúng giỏ cloud, KHÔNG gộp giỏ tài khoản cũ
    if (meta && meta.userId !== userId) {
      hydrateCartFromServer(serverRes.lines, userId, serverRes.updatedAt);
      return;
    }

    // Chưa từng gắn user (giỏ khách thuần trên máy) → gộp vào tài khoản vừa đăng nhập
    if (!meta) {
      if (local.length) {
        const merged = await mergeServerCart(local);
        hydrateCartFromServer(merged.lines, userId, merged.updatedAt);
      } else {
        hydrateCartFromServer(serverRes.lines, userId, serverRes.updatedAt);
      }
      return;
    }

    // Cùng tài khoản, F5 hoặc mở tab mới — không cộng đôi SL
    const serverNewer = serverRes.updatedAt > meta.serverUpdatedAt;
    const localDiffers = linesSignature(local) !== linesSignature(serverRes.lines);

    if (serverNewer) {
      hydrateCartFromServer(serverRes.lines, userId, serverRes.updatedAt);
    } else if (localDiffers && local.length) {
      const saved = await saveServerCart(local);
      writeMeta({ userId, serverUpdatedAt: saved.updatedAt });
    }
  } catch {
    /* giữ giỏ local nếu mạng lỗi */
  } finally {
    queueMicrotask(() => {
      syncPaused = false;
    });
  }
}

export async function syncCartForUser(userId: string): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    await pullOrMergeCart(userId);
    syncedUserId = userId;
    syncInFlight = null;
  })();
  return syncInFlight;
}

/** Đẩy giỏ hiện tại lên server (debounce khi đang sửa). */
export function scheduleCartPushToServer(userId: string) {
  if (syncPaused) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushCartToServerNow(userId);
  }, PUSH_DEBOUNCE_MS);
}

export async function pushCartToServerNow(userId: string): Promise<void> {
  if (syncPaused) return;
  const lines = normalizeLines(useCart.getState().lines);
  try {
    const saved = await saveServerCart(lines);
    writeMeta({ userId, serverUpdatedAt: saved.updatedAt });
  } catch {
    /* không chặn UI */
  }
}

/** Gọi khi trạng thái đăng nhập thay đổi. */
export async function onShopUserChanged(userId: string | null): Promise<void> {
  if (!userId) {
    syncedUserId = null;
    clearMeta();
    // Đăng xuất: xóa giỏ trên máy — tránh tài khoản sau bị gộp/nhìn thấy giỏ người trước
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    syncPaused = true;
    useCart.getState().clear();
    queueMicrotask(() => {
      syncPaused = false;
    });
    return;
  }
  if (syncedUserId === userId) return;
  await syncCartForUser(userId);
}
