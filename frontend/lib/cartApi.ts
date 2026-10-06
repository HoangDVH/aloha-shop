"use client";

import type { CartLine } from "./cart";
import { refreshShopSession } from "./auth";

export type ServerCartResponse = {
  ok: boolean;
  lines: CartLine[];
  updatedAt: string;
  userId: string;
  revision: number;
  reused?: boolean;
};

async function cartFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const send = () =>
    fetch(`/api/shop/cart${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  try {
    let res: Response;
    try {
      res = await send();
      if (res.status === 401 && (await refreshShopSession())) res = await send();
    } catch {
      const timedOut = controller.signal.aborted;
      throw Object.assign(
        new Error(timedOut ? "Mạng chậm, chưa đồng bộ được giỏ hàng." : "Mất kết nối, chưa đồng bộ được giỏ hàng."),
        { code: timedOut ? "timeout" : "network" },
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fallback = res.status >= 500 ? "Máy chủ đang bận, chưa đồng bộ được giỏ hàng." : `HTTP ${res.status}`;
      throw Object.assign(new Error((data as { error?: string }).error || fallback), { status: res.status, code: data.code });
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchServerCart(): Promise<ServerCartResponse> {
  return cartFetch<ServerCartResponse>("");
}

export async function saveServerCart(lines: CartLine[], userId: string, revision: number): Promise<ServerCartResponse> {
  return cartFetch<ServerCartResponse>("", {
    method: "PUT",
    body: JSON.stringify({ lines, userId, revision }),
  });
}

export async function mergeServerCart(guestLines: CartLine[], userId: string, idempotencyKey: string): Promise<ServerCartResponse> {
  return cartFetch<ServerCartResponse>("/merge", {
    method: "POST",
    body: JSON.stringify({ lines: guestLines, userId, idempotencyKey }),
  });
}
