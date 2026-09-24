"use client";
import { useQuery } from "@tanstack/react-query";
import type { ShopUser } from "./auth";

export async function siRequest<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : method,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || `Lỗi máy chủ (${response.status}) — vui lòng thử lại sau`);
  }
  return data as T;
}
export type SiSession = { verified: boolean; user: ShopUser | null; zaloConfigured: boolean; minOrder: number; termsVersion: string };
export function useSiSession() {
  return useQuery({ queryKey: ["shop", "si", "session"], queryFn: () => siRequest<SiSession>("/api/shop/auth/si/session"), refetchInterval: 15000, retry: false });
}
