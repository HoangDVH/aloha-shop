"use client";

import { priceSessionGeneration } from "./priceSession";
import { shopApiBase } from "./api";

export type LivePriceRow = {
  ma: string;
  gia: number;
  priceKind?: "web" | "si" | "si_missing";
  allowBackorder?: boolean;
  ton?: number;
  ten?: string;
  anh?: string;
  path?: string;
  dvt?: string;
  trongLuong?: number;
  isActive?: boolean;
};

type Pending = {
  mas: Set<string>;
  waiters: Array<{
    resolve: (rows: LivePriceRow[]) => void;
    reject: (e: unknown) => void;
    want: string[];
  }>;
  timer: ReturnType<typeof setTimeout> | null;
};

let pending: Pending | null = null;

async function flushPending() {
  const batch = pending;
  pending = null;
  if (!batch) return;
  if (batch.timer) clearTimeout(batch.timer);

  const uniq = [...batch.mas].slice(0, 80);
  if (!uniq.length) {
    for (const w of batch.waiters) w.resolve([]);
    return;
  }

  try {
    const base = shopApiBase();
    const generation = priceSessionGeneration();
  const res = await fetch(`${base}/api/shop/products/prices`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ mas: uniq }),
    });
    if (!res.ok) {
      for (const w of batch.waiters) w.resolve([]);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { items?: LivePriceRow[] };
    if (generation !== priceSessionGeneration()) { for (const w of batch.waiters) w.resolve([]); return; }
    const items = Array.isArray(data.items) ? data.items : [];
    const byMa = new Map(
      items.map((r) => [String(r.ma || "").trim().toUpperCase(), r] as const)
    );
    for (const w of batch.waiters) {
      w.resolve(
        w.want
          .map((m) => byMa.get(m))
          .filter((r): r is LivePriceRow => Boolean(r))
      );
    }
  } catch (e) {
    for (const w of batch.waiters) w.reject(e);
  }
}

/**
 * Giá + tồn mới từ Mongo — coalesce ~250ms để nhiều ProductGrid không đấm N lần / event.
 */
export async function fetchLivePrices(mas: string[]): Promise<LivePriceRow[]> {
  const want = [
    ...new Set(
      mas
        .map((m) => String(m || "").trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, 80);
  if (!want.length) return [];

  return new Promise<LivePriceRow[]>((resolve, reject) => {
    if (!pending) {
      pending = { mas: new Set(), waiters: [], timer: null };
    }
    for (const m of want) pending.mas.add(m);
    pending.waiters.push({ resolve, reject, want });
    if (!pending.timer) {
      pending.timer = setTimeout(() => {
        void flushPending();
      }, 250);
    }
  });
}
