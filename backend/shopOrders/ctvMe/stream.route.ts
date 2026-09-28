/**
 * Route: GET /api/shop/ctv/me/stream (SSE)
 */
import type { Express } from "express";
import type { ShopAuthRequest } from "../../shopAuth/routes.js";
import { syncBus, type SyncChangePayload } from "../../syncBus.js";
import type { CtvMeCtx } from "./shared.js";

export function registerCtvMeStreamRoute(app: Express, ctx: CtvMeCtx) {
  /** SSE portal CTV — commissions / account thay đổi → client invalidate. */
  app.get("/api/shop/ctv/me/stream", ctx.auth, async (req: ShopAuthRequest, res) => {
    const activeCtv = await ctx.requireActiveCtv(req, res);
    if (!activeCtv) return;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    const writeEvent = (event: string, data: unknown) => {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        /* */
      }
    };
    writeEvent("hello", { at: Date.now(), ctvCode: activeCtv.ctvCode });

    const onChange = (payload: SyncChangePayload) => {
      const cols = payload?.collections || [];
      const hit =
        cols.includes("aloha_shop_commissions") ||
        cols.includes("aloha_shop_commission_bills") ||
        cols.includes("aloha_shop_accounts");
      if (!hit) return;
      writeEvent("me", {
        collections: cols,
        ids: payload.ids || [],
        source: payload.source || "",
        at: payload.at || Date.now(),
      });
    };
    syncBus.on("change", onChange);

    const ping = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* */
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(ping);
      syncBus.off("change", onChange);
    };
    req.on("close", cleanup);
    req.on("aborted", cleanup);
  });
}
