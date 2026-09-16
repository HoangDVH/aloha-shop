/**
 * SEO redirects 301 — admin CRUD + public map for Next middleware.
 */
import type { Express, Response } from "express";
import { ObjectId as OID } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import type { GetShopDb } from "../shopOrders/routes.js";

export const REDIRECTS_COL = "aloha_shop_redirects";

function normalizePath(raw: string): string {
  let p = String(raw || "").trim();
  if (!p) return "";
  try {
    if (/^https?:\/\//i.test(p)) {
      const u = new URL(p);
      p = u.pathname + (u.search || "");
    }
  } catch {
    /* keep as path */
  }
  if (!p.startsWith("/")) p = `/${p}`;
  // strip trailing slash except root
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function wouldCreateCycle(
  map: Map<string, string>,
  from: string,
  to: string
): boolean {
  let cur = to;
  const seen = new Set<string>([from]);
  for (let i = 0; i < 20; i++) {
    if (seen.has(cur)) return true;
    const next = map.get(cur);
    if (!next) return false;
    seen.add(cur);
    cur = next;
  }
  return true;
}

export function registerShopSeoRedirectRoutes(
  app: Express,
  getOpsDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getOpsDb), requireActive, requireManager];

  /** Public map — middleware Next gọi (cache ngắn). */
  app.get("/api/shop/redirects/map", async (_req, res: Response) => {
    try {
      const db = await getShopDb();
      const rows = await db
        .collection(REDIRECTS_COL)
        .find({ enabled: true })
        .project({ fromPath: 1, toPath: 1 })
        .toArray();
      const map: Record<string, string> = {};
      for (const r of rows) {
        const from = normalizePath(String(r.fromPath || ""));
        const to = normalizePath(String(r.toPath || ""));
        if (from && to && from !== to) map[from] = to;
      }
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({ map });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "redirects_map_failed" });
    }
  });

  app.get("/api/shop/admin/redirects", ...gate, async (_req, res: Response) => {
    try {
      const db = await getShopDb();
      const items = await db
        .collection(REDIRECTS_COL)
        .find({})
        .sort({ updatedAt: -1 })
        .limit(500)
        .toArray();
      res.json({
        items: items.map((r) => ({
          id: String(r._id),
          fromPath: r.fromPath,
          toPath: r.toPath,
          enabled: r.enabled !== false,
          note: r.note || "",
          updatedAt: r.updatedAt || null,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "redirects_list_failed" });
    }
  });

  app.post("/api/shop/admin/redirects", ...gate, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getShopDb();
      const fromPath = normalizePath(String(req.body?.fromPath || ""));
      const toPath = normalizePath(String(req.body?.toPath || ""));
      const note = String(req.body?.note || "").trim().slice(0, 200);
      if (!fromPath || !toPath) {
        res.status(400).json({ error: "missing_paths", message: "Thiếu đường dẫn từ/đến" });
        return;
      }
      if (fromPath === toPath) {
        res.status(400).json({ error: "same_path", message: "Từ và đến không được trùng" });
        return;
      }
      const existing = await db
        .collection(REDIRECTS_COL)
        .find({})
        .project({ fromPath: 1, toPath: 1, enabled: 1 })
        .toArray();
      const map = new Map<string, string>();
      for (const r of existing) {
        if (r.enabled === false) continue;
        map.set(normalizePath(String(r.fromPath)), normalizePath(String(r.toPath)));
      }
      if (wouldCreateCycle(map, fromPath, toPath)) {
        res.status(400).json({ error: "cycle", message: "Redirect tạo vòng lặp" });
        return;
      }
      const now = new Date().toISOString();
      const dup = await db.collection(REDIRECTS_COL).findOne({ fromPath });
      if (dup) {
        await db.collection(REDIRECTS_COL).updateOne(
          { _id: dup._id },
          {
            $set: {
              toPath,
              enabled: true,
              note,
              updatedAt: now,
              updatedBy: req.auth?.username || null,
            },
          }
        );
        res.json({
          ok: true,
          item: {
            id: String(dup._id),
            fromPath,
            toPath,
            enabled: true,
            note,
            updatedAt: now,
          },
        });
        return;
      }
      const ins = await db.collection(REDIRECTS_COL).insertOne({
        fromPath,
        toPath,
        enabled: true,
        note,
        createdAt: now,
        updatedAt: now,
        updatedBy: req.auth?.username || null,
      });
      res.json({
        ok: true,
        item: {
          id: String(ins.insertedId),
          fromPath,
          toPath,
          enabled: true,
          note,
          updatedAt: now,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "redirect_create_failed" });
    }
  });

  app.patch(
    "/api/shop/admin/redirects/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await getShopDb();
        const id = String(req.params.id || "");
        if (!OID.isValid(id)) {
          res.status(400).json({ error: "bad_id" });
          return;
        }
        const $set: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
          updatedBy: req.auth?.username || null,
        };
        if (req.body?.toPath !== undefined) {
          $set.toPath = normalizePath(String(req.body.toPath));
        }
        if (req.body?.fromPath !== undefined) {
          $set.fromPath = normalizePath(String(req.body.fromPath));
        }
        if (req.body?.enabled !== undefined) {
          $set.enabled = req.body.enabled !== false;
        }
        if (req.body?.note !== undefined) {
          $set.note = String(req.body.note || "").trim().slice(0, 200);
        }
        const r = await db
          .collection(REDIRECTS_COL)
          .findOneAndUpdate(
            { _id: new OID(id) as any },
            { $set },
            { returnDocument: "after" }
          );
        if (!r) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        res.json({
          ok: true,
          item: {
            id: String(r._id),
            fromPath: r.fromPath,
            toPath: r.toPath,
            enabled: r.enabled !== false,
            note: r.note || "",
            updatedAt: r.updatedAt,
          },
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "redirect_patch_failed" });
      }
    }
  );

  app.delete(
    "/api/shop/admin/redirects/:id",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await getShopDb();
        const id = String(req.params.id || "");
        if (!OID.isValid(id)) {
          res.status(400).json({ error: "bad_id" });
          return;
        }
        const r = await db.collection(REDIRECTS_COL).deleteOne({ _id: new OID(id) as any });
        res.json({ ok: true, deleted: r.deletedCount });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "redirect_delete_failed" });
      }
    }
  );
}
