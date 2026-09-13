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

export async function adminFetch<T = unknown>(
  path: string,
  init?: RequestInit
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
