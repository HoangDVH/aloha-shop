/**
 * Routes:
 * OPTIONS /api/shop/catalog/stream
 * GET /api/shop/catalog/stream (SSE)
 */
import type { Express } from "express";
import type { CatalogCtx } from "../catalog/types.js";
import { setCors } from "../catalog/cors.js";
import { syncBus } from "../../syncBus.js";

export function registerCatalogStreamRoutes(app: Express, _ctx: CatalogCtx) {
  /**
   * SSE công khai — khi aloha_products / tồn / giá đổi (app nội bộ → shop realtime).
   * Không JWT (giống xem catalog).
   */
  app.options("/api/shop/catalog/stream", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.get("/api/shop/catalog/stream", (req, res) => {
    setCors(req, res);
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
        /* closed */
      }
    };
    writeEvent("hello", { at: Date.now() });

    const onChange = (payload: { collections?: string[]; ids?: string[]; source?: string }) => {
      const cols = payload?.collections || [];
      const appearanceHit = cols.some(
        (c) =>
          c === "aloha_shop_appearance" ||
          c.includes("appearance") ||
          c.includes("shop_appearance")
      );
      if (appearanceHit) {
        writeEvent("appearance", {
          collections: cols,
          source: payload.source || "",
          at: Date.now(),
        });
      }
      if (cols.includes("aloha_shop_campaigns")) {
        writeEvent("campaign", { ids: payload.ids || [], source: payload.source || "", at: Date.now() });
      }
      if (cols.includes("aloha_shop_flash_counters")) {
        writeEvent("flash", { ids: payload.ids || [], at: Date.now() });
      }
      const hit = cols.some(
        (c) =>
          c === "aloha_products" ||
          c === "noibo_products_kv" ||
          c.includes("product")
      );
      if (!hit) return;
      writeEvent("catalog", {
        collections: cols,
        ids: payload.ids || [],
        source: payload.source || "",
        at: Date.now(),
      });
    };
    syncBus.on("change", onChange);

    const ping = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        /* closed */
      }
    }, 25000);

    const cleanup = () => {
      clearInterval(ping);
      syncBus.off("change", onChange);
    };
    req.on("close", cleanup);
    req.on("aborted", cleanup);
  });
}
