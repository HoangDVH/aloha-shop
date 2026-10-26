/** Client fetch admin API — same-origin qua Next rewrite, kèm cookie staff. */
export class AdminApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.body = body;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Tự động làm mới access token bằng refresh token (14 ngày).
 * Sử dụng chung 1 Promise cho mọi request đồng thời để tránh tình trạng race-condition (thùng nước / thundering herd).
 */
export async function refreshAdminSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function adminFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  _isRetry = false
): Promise<T> {
  const url = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const isAuthRoute =
    url === "/api/auth/login" ||
    url === "/api/auth/refresh" ||
    url === "/api/auth/logout";

  // Khi gặp 401 (Access token hết hạn 1h), tự động silent refresh qua refresh token (14 ngày)
  if (res.status === 401 && !isAuthRoute && !_isRetry) {
    const ok = await refreshAdminSession();
    if (ok) {
      // Refresh thành công -> Thử lại request gốc một cách hoàn toàn trong suốt với người dùng
      return adminFetch<T>(path, init, true);
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new AdminApiError(msg, res.status, data);
  }
  return data as T;
}

export const adminKeys = {
  me: ["admin", "me"] as const,
  ctvSettings: ["admin", "ctv", "settings"] as const,
  ctvStats: ["admin", "ctv", "stats"] as const,
  ctvRates: (q: string) => ["admin", "ctv", "rates", q] as const,
  ctvOverrides: ["admin", "ctv", "overrides"] as const,
  ctvCommissions: (period: string) => ["admin", "ctv", "commissions", period] as const,
  ctvBills: (period: string) => ["admin", "ctv", "bills", period] as const,
  ctvFraud: ["admin", "ctv", "fraud"] as const,
  accounts: (tab: string, q: string, page: number) =>
    ["admin", "accounts", tab, q, page] as const,
  accountsStats: ["admin", "accounts", "stats"] as const,
  appearance: ["admin", "appearance"] as const,
  products: (qs: string) => ["admin", "products", qs] as const,
  articles: (qs: string) => ["admin", "articles", qs] as const,
};
