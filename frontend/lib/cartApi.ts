"use client";

import type { CartLine } from "./cart";

export type ServerCartResponse = {
  ok: boolean;
  lines: CartLine[];
  updatedAt: string;
};

async function cartFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/shop/cart${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchServerCart(): Promise<ServerCartResponse> {
  return cartFetch<ServerCartResponse>("");
}

export async function saveServerCart(lines: CartLine[]): Promise<ServerCartResponse> {
  return cartFetch<ServerCartResponse>("", {
    method: "PUT",
    body: JSON.stringify({ lines }),
  });
}

export async function mergeServerCart(guestLines: CartLine[]): Promise<ServerCartResponse> {
  return cartFetch<ServerCartResponse>("/merge", {
    method: "POST",
    body: JSON.stringify({ lines: guestLines }),
  });
}
