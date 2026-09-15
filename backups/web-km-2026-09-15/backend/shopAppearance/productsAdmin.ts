import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { redisInvalidateShopCache } from "../redis.js";
import { syncBus } from "../syncBus.js";
import { normalizeString } from "../utils/helpers.ts";
import {
  normalizeWebKmInput,
  pushOfferSnapshot,
  readGiaWebLichSu,
  resolveGiaThamChieu,
  resolveShopSellPrice,
  validateWebKmAgainstRef,
  webKmBulkSchema,
  LOOKBACK_DAYS,
  baseGiaWeb,
  appendGiaWebLichSu,
  groupPriceHistoryRows,
} from "../shopCatalog/webKm.js";
import {
  buildShopCategoryMongoFilter,
  parseCategoryIdList,
  parseNhomList,
} from "../shopCatalog/categoryQueryFilter.js";

const COL = "aloha_products";

function publicPrice(doc: Record<string, unknown>): number {
  const n = Number(
    doc.giaWeb ?? doc.giaBan ?? doc.giaChung ?? doc.basePrice ?? 0
  );
  return Number.isFinite(n) ? n : 0;
}

function publicTon(doc: Record<string, unknown>): number {
  const n = Number(doc.ton ?? doc.onHand ?? doc.kvTon ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function publicAnh(doc: Record<string, unknown>): string {
  const anh = doc.anh;
  if (typeof anh === "string" && anh) return anh;
  const images = doc.images;
  if (Array.isArray(images) && images[0]) return String(images[0]);
  return "";
}

/**
 * Điểm khớp tìm admin — ưu tiên mã đúng.
 * 100 = mã exact, 80 = mã bắt đầu bằng, 60 = mã chứa chuỗi,
 * 40/20 = tên/barcode; 0 = không khớp.
 */
function productQueryScore(
  doc: { ma?: unknown; ten?: unknown; barcode?: unknown },
  q: string
): number {
  const needle = normalizeString(q);
  if (!needle) return 100;
  const ma = normalizeString(String(doc.ma || "")).replace(/\s+/g, "");
  const ten = normalizeString(String(doc.ten || ""));
  const barcode = normalizeString(String(doc.barcode || "")).replace(/\s+/g, "");
  const needleCompact = needle.replace(/\s+/g, "");

  if (ma && ma === needleCompact) return 100;
  if (barcode && barcode === needleCompact) return 95;
  if (ma && ma.startsWith(needleCompact)) return 80;
  if (ma && ma.includes(needleCompact)) return 60;
  if (barcode && barcode.includes(needleCompact)) return 50;

  const tokens = needle.split(/\s+/).filter(Boolean);
  if (!ten) return 0;
  if (tokens.length <= 1) {
    return ten.includes(needle) || ten.replace(/\s+/g, "").includes(needleCompact)
      ? 40
      : 0;
  }
  return tokens.every((t) => ten.includes(t) || ten.replace(/\s+/g, "").includes(t))
    ? 40
    : 0;
}

export function registerShopProductsAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb?: GetDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];
  const productsDb = getShopDb || getDb;

  app.get(
    "/api/shop/admin/products",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const q = String(req.query.q || "").trim();
        const nhomList = parseNhomList(req.query as Record<string, unknown>);
        const categoryIdList = parseCategoryIdList(
          req.query as Record<string, unknown>
        );
        const visible = String(req.query.visible || "all");
        const badge = String(req.query.badge || "all").trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));

        const and: object[] = [
          { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
        ];
        const catFilter = await buildShopCategoryMongoFilter(db, {
          nhomList,
          categoryIdList,
        });
        if (catFilter) and.push(catFilter);
        if (visible === "1" || visible === "0") {
          if (visible === "0") and.push({ hienThiWeb: false });
          else
            and.push({
              $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
            });
        }
        if (badge === "auto") {
          and.push({
            $or: [
              { webBadge: { $exists: false } },
              { webBadge: null },
              { webBadge: "" },
              { webBadge: { $nin: ["ban_chay", "moi", "noi_bat"] } },
            ],
          });
        } else if (
          badge === "ban_chay" ||
          badge === "moi" ||
          badge === "noi_bat"
        ) {
          and.push({ webBadge: badge });
        }

        const filter = { $and: and };
        const col = db.collection(COL);
        const projection = {
          ma: 1,
          ten: 1,
          anh: 1,
          images: 1,
          nhom: 1,
          nhomPath: 1,
          categoryId: 1,
          categoryName: 1,
          giaWeb: 1,
          giaBan: 1,
          giaChung: 1,
          basePrice: 1,
          webKm: 1,
          giaWebLichSu: 1,
          ton: 1,
          onHand: 1,
          kvTon: 1,
          hienThiWeb: 1,
          webPin: 1,
          webBadge: 1,
          barcode: 1,
        };

        let rows: any[];
        let total: number;

        if (q) {
          // Quét theo lọc nhóm/trạng thái rồi xếp theo độ khớp mã.
          const all = await col
            .find(filter as any)
            .project(projection)
            .toArray();
          const scored = all
            .map((d) => ({ d, score: productQueryScore(d, q) }))
            .filter((x) => x.score > 0);
          // Có mã khớp đúng → chỉ giữ exact (tránh KTMN30 kéo theo TKTMN30).
          const hasExactMa = scored.some((x) => x.score >= 100);
          const ranked = (hasExactMa
            ? scored.filter((x) => x.score >= 100)
            : scored
          ).sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return String(a.d.ten || "").localeCompare(String(b.d.ten || ""), "vi");
          });
          total = ranked.length;
          rows = ranked
            .slice((page - 1) * limit, page * limit)
            .map((x) => x.d);
        } else {
          [total, rows] = await Promise.all([
            col.countDocuments(filter as any),
            col
              .find(filter as any)
              .project(projection)
              .sort({ ten: 1 })
              .skip((page - 1) * limit)
              .limit(limit)
              .toArray(),
          ]);
        }

        const items = rows.map((d) => {
          const sell = resolveShopSellPrice(d as any);
          return {
            ma: String(d.ma || ""),
            ten: String(d.ten || ""),
            anh: publicAnh(d as any),
            nhom: String(d.nhom || d.categoryName || ""),
            nhomPath: String(d.nhomPath || d.nhom || d.categoryName || ""),
            categoryId: Number(d.categoryId) || 0,
            categoryName: String(d.categoryName || ""),
            gia: sell.gia,
            giaWeb: sell.giaWeb,
            giaThamChieu: sell.giaThamChieu,
            giaWebTangAo: sell.giaWebTangAo,
            dangKm: sell.dangKm,
            giaGoc: sell.dangKm ? sell.giaGoc : undefined,
            phanTramGiam: sell.dangKm ? sell.phanTramGiam : undefined,
            webKm: d.webKm && typeof d.webKm === "object" ? d.webKm : null,
            ton: publicTon(d as any),
            hienThiWeb: d.hienThiWeb !== false,
            webPin: Number(d.webPin) > 0 ? Math.round(Number(d.webPin)) : 0,
            webBadge:
              d.webBadge === "ban_chay" ||
              d.webBadge === "moi" ||
              d.webBadge === "noi_bat"
                ? String(d.webBadge)
                : "",
          };
        });

        res.json({
          items,
          total,
          page,
          pages: Math.max(1, Math.ceil(total / limit)),
          limit,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "admin_products_failed" });
      }
    }
  );

  app.patch(
    "/api/shop/admin/products/:ma/merchandising",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const ma = String(req.params.ma || "").trim();
        if (!ma) {
          res.status(400).json({ error: "missing_ma" });
          return;
        }
        const maFilter = {
          $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }],
        } as any;
        const existing = await db.collection(COL).findOne(maFilter);
        if (!existing) {
          res.status(404).json({ error: "not_found" });
          return;
        }

        const byName =
          String(
            (req as any).user?.name ||
              (req as any).user?.username ||
              (req as any).auth?.username ||
              ""
          ).trim() || undefined;

        const $set: Record<string, unknown> = {
          merchandisingUpdatedAt: new Date().toISOString(),
        };
        if (req.body?.webPin !== undefined) {
          const n = Number(req.body.webPin);
          $set.webPin =
            Number.isFinite(n) && n > 0 ? Math.min(9999, Math.round(n)) : 0;
        }
        if (req.body?.webBadge !== undefined) {
          const b = String(req.body.webBadge || "").trim();
          $set.webBadge =
            b === "ban_chay" || b === "moi" || b === "noi_bat" ? b : "";
        }

        if (req.body?.webKm !== undefined) {
          const docForRef = { ...existing } as Record<string, unknown>;
          const at = new Date().toISOString();
          const giaWebNow = baseGiaWeb(docForRef);
          let lichSu = readGiaWebLichSu(docForRef);

          if (req.body.webKm === null) {
            $set.webKm = null;
            docForRef.webKm = null;
            lichSu = appendGiaWebLichSu(lichSu, giaWebNow, {
              at,
              by: byName,
              giaWeb: giaWebNow,
              giaKm: null,
              phanTram: null,
            });
            $set.giaWebLichSu = lichSu;
          } else {
            const giaKm = Math.round(Number(req.body.webKm?.gia) || 0);
            const giaThamChieu = resolveGiaThamChieu(
              {
                ...docForRef,
                giaWebLichSu: lichSu,
              },
              Date.now(),
              giaKm > 0 ? { excludeGia: giaKm } : undefined
            );
            const normalized = normalizeWebKmInput(
              {
                gia: Number(req.body.webKm?.gia),
                phanTram:
                  req.body.webKm?.phanTram != null
                    ? Number(req.body.webKm.phanTram)
                    : undefined,
                tu: req.body.webKm?.tu,
                den: req.body.webKm?.den,
              },
              giaThamChieu
            );
            const err = validateWebKmAgainstRef(normalized, giaThamChieu);
            if (err) {
              res.status(400).json({
                error: err,
                code: "web_km_invalid",
                giaThamChieu,
              });
              return;
            }
            $set.webKm = normalized;
            lichSu = appendGiaWebLichSu(lichSu, normalized.gia, {
              at,
              by: byName,
              giaWeb: giaWebNow,
              giaKm: normalized.gia,
              phanTram: normalized.phanTram ?? null,
            });
            $set.giaWebLichSu = lichSu;
          }
        }

        const r = await db.collection(COL).updateOne(maFilter, { $set });
        if (!r.matchedCount) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "web-merchandising", { ids: [ma] });
        const updated = await db.collection(COL).findOne(maFilter);
        const sell = resolveShopSellPrice((updated || existing) as any);
        res.json({
          ok: true,
          ma,
          webKm: (updated as any)?.webKm ?? $set.webKm ?? null,
          gia: sell.gia,
          giaWeb: sell.giaWeb,
          giaThamChieu: sell.giaThamChieu,
          giaWebTangAo: sell.giaWebTangAo,
          dangKm: sell.dangKm,
          giaGoc: sell.giaGoc,
          phanTramGiam: sell.phanTramGiam,
          webPin: $set.webPin,
          webBadge: $set.webBadge,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "merchandising_failed" });
      }
    }
  );

  app.get(
    "/api/shop/admin/products/:ma/price-history",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const ma = String(req.params.ma || "").trim();
        if (!ma) {
          res.status(400).json({ error: "missing_ma" });
          return;
        }
        const doc = await db.collection(COL).findOne({
          $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }],
        } as any);
        if (!doc) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        const from = String(req.query.from || "").trim();
        const to = String(req.query.to || "").trim();
        const fromMs = from ? Date.parse(from) : NaN;
        const toMs = to ? Date.parse(to) : NaN;
        let points = readGiaWebLichSu(doc as any);
        if (Number.isFinite(fromMs)) {
          points = points.filter((p) => {
            const t = Date.parse(p.at);
            return Number.isFinite(t) && t >= fromMs;
          });
        }
        if (Number.isFinite(toMs)) {
          points = points.filter((p) => {
            const t = Date.parse(p.at);
            return Number.isFinite(t) && t <= toMs;
          });
        }
        const sell = resolveShopSellPrice(doc as any);
        const rows = groupPriceHistoryRows(points).reverse();
        res.json({
          ma,
          lookbackDays: LOOKBACK_DAYS,
          giaWeb: sell.giaWeb,
          giaThamChieu: sell.giaThamChieu,
          giaWebTangAo: sell.giaWebTangAo,
          points: rows,
          rows,
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "price_history_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/products/web-km/bulk",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const parsed = webKmBulkSchema.safeParse(req.body || {});
        if (!parsed.success) {
          res.status(400).json({
            error: "Dữ liệu bulk không hợp lệ",
            details: parsed.error.flatten(),
          });
          return;
        }
        const { mode, phanTram, tu, den } = parsed.data;
        if (mode === "apply" && !(phanTram && phanTram >= 1 && phanTram <= 99)) {
          res.status(400).json({ error: "Cần % giảm từ 1–99" });
          return;
        }
        const db = await productsDb();
        const byName =
          String(
            (req as any).user?.name ||
              (req as any).user?.username ||
              ""
          ).trim() || undefined;

        const filter = {
          $and: [
            { $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }] },
            {
              $or: [
                { hienThiWeb: { $ne: false } },
                { hienThiWeb: { $exists: false } },
              ],
            },
            {
              $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            },
          ],
        };
        const docs = await db
          .collection(COL)
          .find(filter as any)
          .project({
            ma: 1,
            giaWeb: 1,
            giaBan: 1,
            giaChung: 1,
            basePrice: 1,
            webKm: 1,
            giaWebLichSu: 1,
          })
          .toArray();

        let updated = 0;
        const skipped: Array<{ ma: string; reason: string }> = [];
        const ids: string[] = [];

        for (const d of docs) {
          const ma = String(d.ma || "").trim();
          if (!ma) continue;
          const doc = d as Record<string, unknown>;
          let lichSu = pushOfferSnapshot(doc, { by: byName });

          if (mode === "clear") {
            if (!doc.webKm) {
              skipped.push({ ma, reason: "Không có KM" });
              continue;
            }
            await db.collection(COL).updateOne(
              { ma } as any,
              {
                $set: {
                  webKm: null,
                  giaWebLichSu: pushOfferSnapshot(
                    { ...doc, webKm: null, giaWebLichSu: lichSu },
                    { by: byName }
                  ),
                  merchandisingUpdatedAt: new Date().toISOString(),
                },
              }
            );
            updated += 1;
            ids.push(ma);
            continue;
          }

          const refDoc = { ...doc, giaWebLichSu: lichSu };
          const giaThamChieu = resolveGiaThamChieu(refDoc);
          if (!(giaThamChieu > 0)) {
            skipped.push({ ma, reason: "Chưa có giá web" });
            continue;
          }
          const normalized = normalizeWebKmInput(
            { phanTram: phanTram!, tu, den },
            giaThamChieu
          );
          const err = validateWebKmAgainstRef(normalized, giaThamChieu);
          if (err) {
            skipped.push({ ma, reason: err });
            continue;
          }
          lichSu = pushOfferSnapshot(
            { ...refDoc, webKm: normalized },
            { by: byName }
          );
          await db.collection(COL).updateOne(
            { ma } as any,
            {
              $set: {
                webKm: normalized,
                giaWebLichSu: lichSu,
                merchandisingUpdatedAt: new Date().toISOString(),
              },
            }
          );
          updated += 1;
          ids.push(ma);
        }

        await redisInvalidateShopCache();
        if (ids.length) {
          syncBus.publish(["aloha_products"], "web-km-bulk", {
            ids: ids.slice(0, 50),
          });
        }
        res.json({
          ok: true,
          mode,
          updated,
          skippedCount: skipped.length,
          skipped: skipped.slice(0, 40),
        });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "web_km_bulk_failed" });
      }
    }
  );

  app.patch(
    "/api/shop/admin/products/:ma/visibility",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const ma = String(req.params.ma || "").trim();
        if (!ma) {
          res.status(400).json({ error: "missing_ma" });
          return;
        }
        const hienThiWeb = req.body?.hienThiWeb !== false;
        const r = await db.collection(COL).updateOne(
          {
            $or: [{ ma }, { ma: ma.toUpperCase() }, { ma: ma.toLowerCase() }],
          } as any,
          { $set: { hienThiWeb, hienThiWebUpdatedAt: new Date().toISOString() } }
        );
        if (!r.matchedCount) {
          res.status(404).json({ error: "not_found" });
          return;
        }
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "hienThiWeb", { ids: [ma] });
        res.json({ ok: true, ma, hienThiWeb });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "visibility_failed" });
      }
    }
  );

  app.post(
    "/api/shop/admin/products/visibility/bulk",
    ...gate,
    async (req: AuthRequest, res: Response) => {
      try {
        const db = await productsDb();
        const mas = Array.isArray(req.body?.mas)
          ? req.body.mas.map((m: unknown) => String(m || "").trim()).filter(Boolean)
          : [];
        const hienThiWeb = req.body?.hienThiWeb !== false;
        if (!mas.length) {
          res.status(400).json({ error: "missing_mas" });
          return;
        }
        const r = await db.collection(COL).updateMany(
          { ma: { $in: mas } } as any,
          { $set: { hienThiWeb, hienThiWebUpdatedAt: new Date().toISOString() } }
        );
        await redisInvalidateShopCache();
        syncBus.publish(["aloha_products"], "hienThiWeb-bulk", { ids: mas.slice(0, 50) });
        res.json({ ok: true, matched: r.matchedCount, modified: r.modifiedCount, hienThiWeb });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || "bulk_visibility_failed" });
      }
    }
  );
}

/** Điều kiện catalog khách — thiếu field = vẫn hiện. */
export function hienThiWebFilterClause(): object {
  return {
    $or: [{ hienThiWeb: { $ne: false } }, { hienThiWeb: { $exists: false } }],
  };
}
