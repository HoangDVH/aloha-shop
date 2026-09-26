/**
 * Fill-only reconcile: ops (CMS) videos → shop when shop is empty.
 * Never overwrites non-empty shop videos. KV sync must not own these fields.
 */
import type { Db } from "mongodb";
import {
  normalizeProductVideos,
  publicProductVideos,
} from "./productVideoUrl.js";
import { syncBus } from "../syncBus.js";

const PRODUCT_COL = "aloha_products";
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

export type VideoReconcileResult = {
  scanned: number;
  filled: number;
  skipped: number;
  missingOnShop: number;
  ids: string[];
};

export async function reconcileProductVideosFromOps(
  shopDb: Db,
  opsDb: Db
): Promise<VideoReconcileResult> {
  const ops = opsDb.collection(PRODUCT_COL);
  const shop = shopDb.collection(PRODUCT_COL);
  const cursor = ops.find(
    {
      $or: [
        { videoUrl: { $type: "string", $ne: "" } },
        { videos: { $elemMatch: { $type: "string", $ne: "" } } },
      ],
    },
    { projection: { ma: 1, videos: 1, videoUrl: 1 } }
  );

  let scanned = 0;
  let filled = 0;
  let skipped = 0;
  let missingOnShop = 0;
  const ids: string[] = [];

  for await (const doc of cursor) {
    scanned += 1;
    const ma = String(doc.ma || "").trim().toUpperCase();
    const urls = publicProductVideos(doc as Record<string, unknown>);
    if (!ma || !urls.length) continue;

    const target = await shop.findOne(
      { ma },
      { projection: { _id: 1, ma: 1, videos: 1, videoUrl: 1 } }
    );
    if (!target) {
      missingOnShop += 1;
      continue;
    }

    // Also repair shop docs that only have videoUrl / empty videos[]
    const shopUrls = publicProductVideos(target as Record<string, unknown>);
    const hasArr =
      Array.isArray(target.videos) &&
      target.videos.some((u: unknown) => String(u || "").trim());

    if (shopUrls.length && hasArr) {
      skipped += 1;
      continue;
    }

    const next = normalizeProductVideos(shopUrls.length ? shopUrls : urls);
    if (!next.length) {
      skipped += 1;
      continue;
    }

    const result = await shop.updateOne(
      { _id: target._id },
      {
        $set: { videos: next, videoUrl: next[0] },
        // Never $unset videoUrl — dual-read remains the safety net.
      }
    );
    if (result.modifiedCount) {
      filled += 1;
      ids.push(String(target.ma || ma));
    } else {
      skipped += 1;
    }
  }

  if (ids.length) {
    syncBus.publish(["aloha_products"], "video-reconcile", { ids: ids.slice(0, 50) });
  }

  return { scanned, filled, skipped, missingOnShop, ids };
}

/** Quiet worker: fill gaps only. Disable with SHOP_VIDEO_RECONCILE_ENABLED=0. */
export function startProductVideoReconcileWorker(
  getShopDb: () => Promise<Db>,
  getOpsDb: () => Promise<Db>
) {
  if (process.env.SHOP_VIDEO_RECONCILE_ENABLED === "0") return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await reconcileProductVideosFromOps(await getShopDb(), await getOpsDb());
    } catch {
      /* Durable fill-only; next tick retries. */
    } finally {
      running = false;
    }
  };
  // First pass shortly after boot, then periodic.
  const initial = setTimeout(() => {
    void tick();
  }, 20_000);
  const timer = setInterval(() => {
    void tick();
  }, DEFAULT_INTERVAL_MS);
  initial.unref?.();
  timer.unref?.();
  return () => {
    clearTimeout(initial);
    clearInterval(timer);
  };
}
