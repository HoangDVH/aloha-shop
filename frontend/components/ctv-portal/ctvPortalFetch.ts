import { shopApiBase } from "@/lib/api";

export async function ctvPortalFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const base = shopApiBase();
  const res = await fetch(`${base}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
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
