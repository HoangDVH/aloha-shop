"use client";
import { useQuery } from "@tanstack/react-query";
import type { ShopUser } from "./auth";

export async function siRequest<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : method,
    credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Chưa xử lý được yêu cầu");
  return data;
}
export type SiSession = { verified: boolean; user: ShopUser | null; zaloConfigured: boolean; minOrder: number; termsVersion: string };
export function useSiSession() {
  return useQuery({ queryKey: ["shop", "si", "session"], queryFn: () => siRequest<SiSession>("/api/shop/auth/si/session"), refetchInterval: 15000, retry: false });
}
