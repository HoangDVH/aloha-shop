"use client";

export type ShopRole = "customer" | "ctv";
export type CtvStatus = "cho_duyet" | "active" | "khoa";

export type ShopUser = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  roles: ShopRole[];
  ctvCode: string | null;
  ctvStatus: CtvStatus | null;
  active: boolean;
  authProviders: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  addresses?: {
    id: string;
    fullName: string;
    phone: string;
    province: string;
    ward: string;
    detail: string;
    label?: string;
    isDefault: boolean;
  }[];
};

async function shopAuthFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/shop/auth${path}`, {
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

export async function fetchShopMe(): Promise<ShopUser | null> {
  try {
    const data = await shopAuthFetch<{ user: ShopUser }>("/me");
    return data.user;
  } catch {
    try {
      await shopAuthFetch("/refresh", { method: "POST" });
      const data = await shopAuthFetch<{ user: ShopUser }>("/me");
      return data.user;
    } catch {
      return null;
    }
  }
}

export async function shopLogin(email: string, password: string) {
  return shopAuthFetch<{ user: ShopUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function shopRegister(body: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  roles: ShopRole[];
  ctvCode?: string;
}) {
  return shopAuthFetch<{ user: ShopUser }>("/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function shopLogout(): Promise<{ ok: boolean }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      await shopAuthFetch("/logout", {
        method: "POST",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  } catch {
    /* logout fail mềm — client vẫn xóa session */
  }
  return { ok: true };
}

export async function shopUpdateMe(body: {
  fullName?: string;
  phone?: string;
  becomeCtv?: boolean;
  ctvCode?: string;
}) {
  return shopAuthFetch<{ user: ShopUser }>("/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function googleStartUrl(next = "/") {
  const n = encodeURIComponent(safeAuthNext(next));
  const origin =
    typeof window !== "undefined"
      ? encodeURIComponent(window.location.origin)
      : "";
  const o = origin ? `&origin=${origin}` : "";
  return `/api/shop/auth/google/start?next=${n}${o}`;
}

/** Không vòng về trang auth; chỉ cho phép path nội bộ. */
export function safeAuthNext(raw: string | null | undefined, fallback = "/") {
  const next = String(raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  const pathOnly = next.split("?")[0] || "/";
  if (
    pathOnly === "/dang-nhap" ||
    pathOnly === "/dang-ky" ||
    pathOnly === "/cho-duyet-ctv"
  ) {
    return fallback;
  }
  return next;
}

/** Link đăng nhập kèm trang quay lại sau khi đăng nhập xong. */
export function shopLoginHref(nextPath?: string | null) {
  return `/dang-nhap?next=${encodeURIComponent(safeAuthNext(nextPath))}`;
}
