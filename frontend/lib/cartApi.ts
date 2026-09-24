"use client";

import type { CartLine } from "./cart";

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
  try {
    const res = await fetch(`/api/shop/cart${path}`, {
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error((data as { error?: string }).error || `HTTP ${res.status}`), { status: res.status, code: data.code });
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
