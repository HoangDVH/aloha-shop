"use client";

import { priceSessionGeneration } from "./priceSession";
import { shopApiBase } from "./api";

export type LivePriceRow = {
  ma: string;
  gia: number;
  webPrice?: number;
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

async function fetchPriceChunk(mas: string[], generation: number): Promise<LivePriceRow[]> {
  const base = shopApiBase();
  const res = await fetch(`${base}/api/shop/products/prices`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ mas }),
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { items?: LivePriceRow[] };
  if (generation !== priceSessionGeneration()) return [];
  return Array.isArray(data.items) ? data.items : [];
}

async function flushPending() {
  const batch = pending;
  pending = null;
  if (!batch) return;
  if (batch.timer) clearTimeout(batch.timer);

  const allMas = [...batch.mas];
  if (!allMas.length) {
    for (const w of batch.waiters) w.resolve([]);
    return;
  }

  try {
    const generation = priceSessionGeneration();
    const CHUNK_SIZE = 80;
    const chunks: string[][] = [];
    for (let i = 0; i < allMas.length; i += CHUNK_SIZE) {
      chunks.push(allMas.slice(i, i + CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) => fetchPriceChunk(chunk, generation))
    );

    if (generation !== priceSessionGeneration()) {
      for (const w of batch.waiters) w.resolve([]);
      return;
    }

    const items = chunkResults.flat();
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
  ];
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
