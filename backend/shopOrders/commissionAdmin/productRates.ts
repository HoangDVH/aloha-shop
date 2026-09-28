import type { Express } from "express";
import {
  type CommissionAdminCtx,
  type AuthRequest,
  vietLooseRegexSource,
} from "./shared.js";
import { getCtvSettings, saveCtvSettings } from "../commissionModels.js";
import { redisInvalidateShopCache } from "../../redis.js";

export function registerProductRates(app: Express, ctx: CommissionAdminCtx) {
  const { getDb, getShopDb, gate, ensure } = ctx;

  /** Patch % hoa hồng theo SP (main DB aloha_products). */
  app.post("/api/shop/admin/ctv/product-rates", ...gate, async (req: AuthRequest, res) => {
    try {
      const mainDb = await getDb();
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ error: "missing_items" });
      let updated = 0;
      for (const it of items.slice(0, 500)) {
        const ma = String(it?.ma || "").trim().toUpperCase();
        if (!ma) continue;
        const $set: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
        };
        if (it.ctvCommissionRate != null && it.ctvCommissionRate !== "") {
          $set.ctvCommissionRate = Math.max(0, Number(it.ctvCommissionRate) || 0);
        }
        if (it.ctvExcluded != null) $set.ctvExcluded = Boolean(it.ctvExcluded);
        if (it.clearRate) {
          await mainDb.collection("aloha_products").updateOne(
            { $or: [{ ma }, { ma: ma.toLowerCase() }] },
            { $unset: { ctvCommissionRate: "" }, $set: { updatedAt: $set.updatedAt } }
          );
          updated += 1;
          continue;
        }
        const r = await mainDb.collection("aloha_products").updateOne(
          { $or: [{ ma }, { ma: ma.toLowerCase() }] },
          { $set }
        );
        if (r.matchedCount) updated += 1;
      }
      try {
        await redisInvalidateShopCache();
      } catch {
        // ignore cache error
      }
      return res.json({ ok: true, updated });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "product_rates_failed" });
    }
  });

  /**
   * Cấu hình hoa hồng hàng loạt / toàn bộ sản phẩm (chuẩn sàn Shopee / TikTok Shop).
   * Actions:
   * - "set_shop_default": Cập nhật tỷ lệ hoa hồng toàn shop (Shop-wide Default Rate)
   *   + applyMode: "unconfigured_only" (giữ SP có cấu hình riêng) | "overwrite_all" (đồng bộ đưa tất cả SP về mức mới)
   * - "apply_all_products": Ghi đè áp dụng % hoa hồng cho TẤT CẢ sản phẩm trong shop
   * - "reset_all_to_default": Khôi phục toàn bộ sản phẩm về tỷ lệ mặc định shop (xóa mọi cấu hình riêng lẻ)
   * - "bulk_set_selected": Cập nhật cho danh sách mã sản phẩm được chọn (áp dụng % hoặc xóa về mặc định)
   */
  app.post("/api/shop/admin/ctv/product-rates/bulk", ...gate, async (req: AuthRequest, res) => {
    try {
      const mainDb = await getDb();
      const shopDb = await getShopDb();
      await ensure(shopDb);

      const action = String(req.body?.action || "").trim();
      const now = new Date().toISOString();
      const baseFilter: Record<string, unknown> = { deletedAt: null, isActive: { $ne: false } };

      if (action === "set_shop_default") {
        const rawRate = Number(req.body?.rate);
        if (!Number.isFinite(rawRate) || rawRate < 0) {
          return res.status(400).json({ error: "invalid_rate", message: "Tỷ lệ hoa hồng phải là số ≥ 0" });
        }
        const rate = Math.round(rawRate * 100) / 100;
        const applyMode = String(req.body?.applyMode || "unconfigured_only");

        // Cập nhật tỷ lệ hoa hồng toàn shop vào settings
        const updatedSettings = await saveCtvSettings(shopDb, { defaultCommissionRate: rate });

        let modifiedProducts = 0;
        if (applyMode === "overwrite_all") {
          // Xóa cấu hình riêng của toàn bộ sản phẩm để đồng bộ dùng chung defaultCommissionRate
          const r = await mainDb.collection("aloha_products").updateMany(
            baseFilter,
            { $unset: { ctvCommissionRate: "" }, $set: { updatedAt: now } }
          );
          modifiedProducts = r.modifiedCount || 0;
        }

        try {
          await redisInvalidateShopCache();
        } catch {
          // ignore cache error
        }

        return res.json({
          ok: true,
          action,
          defaultRate: updatedSettings.defaultCommissionRate,
          modifiedProducts,
          message:
            applyMode === "overwrite_all"
              ? `Đã cập nhật tỷ lệ toàn shop thành ${rate}% và đồng bộ cho tất cả sản phẩm`
              : `Đã cập nhật tỷ lệ toàn shop thành ${rate}% (áp dụng cho các sản phẩm chưa cài đặt riêng)`,
        });
      }

      if (action === "apply_all_products") {
        const rawRate = Number(req.body?.rate);
        if (!Number.isFinite(rawRate) || rawRate < 0) {
          return res.status(400).json({ error: "invalid_rate", message: "Tỷ lệ hoa hồng phải là số ≥ 0" });
        }
        const rate = Math.round(rawRate * 100) / 100;

        const r = await mainDb.collection("aloha_products").updateMany(
          baseFilter,
          { $set: { ctvCommissionRate: rate, updatedAt: now } }
        );

        try {
          await redisInvalidateShopCache();
        } catch {
          // ignore cache error
        }

        return res.json({
          ok: true,
          action,
          rate,
          modifiedProducts: r.modifiedCount || 0,
          message: `Đã áp dụng tỷ lệ ${rate}% cho tất cả ${r.modifiedCount || 0} sản phẩm trong shop`,
        });
      }

      if (action === "reset_all_to_default") {
        const r = await mainDb.collection("aloha_products").updateMany(
          baseFilter,
          { $unset: { ctvCommissionRate: "" }, $set: { updatedAt: now } }
        );

        try {
          await redisInvalidateShopCache();
        } catch {
          // ignore cache error
        }

        return res.json({
          ok: true,
          action,
          modifiedProducts: r.modifiedCount || 0,
          message: `Đã khôi phục toàn bộ ${r.modifiedCount || 0} sản phẩm về mức mặc định shop`,
        });
      }

      if (action === "bulk_set_selected") {
        const maList = Array.isArray(req.body?.maList)
          ? req.body.maList.map((x: any) => String(x || "").trim().toUpperCase()).filter(Boolean)
          : [];
        if (!maList.length) {
          return res.status(400).json({ error: "missing_ma_list", message: "Chưa chọn sản phẩm nào" });
        }

        const clearRate = Boolean(req.body?.clearRate);
        const rawRate = Number(req.body?.rate);

        let r;
        if (clearRate) {
          r = await mainDb.collection("aloha_products").updateMany(
            { ...baseFilter, ma: { $in: maList } },
            { $unset: { ctvCommissionRate: "" }, $set: { updatedAt: now } }
          );
        } else {
          if (!Number.isFinite(rawRate) || rawRate < 0) {
            return res.status(400).json({ error: "invalid_rate", message: "Tỷ lệ hoa hồng phải là số ≥ 0" });
          }
          const rate = Math.round(rawRate * 100) / 100;
          r = await mainDb.collection("aloha_products").updateMany(
            { ...baseFilter, ma: { $in: maList } },
            { $set: { ctvCommissionRate: rate, updatedAt: now } }
          );
        }

        try {
          await redisInvalidateShopCache();
        } catch {
          // ignore cache error
        }

        return res.json({
          ok: true,
          action,
          modifiedProducts: r.modifiedCount || 0,
          message: clearRate
            ? `Đã khôi phục ${r.modifiedCount || 0} sản phẩm về mặc định shop`
            : `Đã cập nhật ${r.modifiedCount || 0} sản phẩm sang mức ${rawRate}%`,
        });
      }

      return res.status(400).json({ error: "invalid_action", message: "Hành động không hợp lệ" });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "bulk_product_rates_failed" });
    }
  });

  /** Thống kê phân bổ tỷ lệ hoa hồng toàn shop. */
  app.get("/api/shop/admin/ctv/product-rates-stats", ...gate, async (_req, res) => {
    try {
      const mainDb = await getDb();
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const settings = await getCtvSettings(shopDb);

      const col = mainDb.collection("aloha_products");
      const baseFilter = { deletedAt: null, isActive: { $ne: false } };

      const [totalProducts, customRateProducts, excludedProducts] = await Promise.all([
        col.countDocuments(baseFilter),
        col.countDocuments({
          ...baseFilter,
          ctvExcluded: { $ne: true },
          ctvCommissionRate: { $exists: true, $ne: null },
        }),
        col.countDocuments({
          ...baseFilter,
          ctvExcluded: true,
        }),
      ]);

      const defaultRateProducts = Math.max(0, totalProducts - customRateProducts - excludedProducts);

      return res.json({
        ok: true,
        defaultRate: settings.defaultCommissionRate,
        totalProducts,
        defaultRateProducts,
        customRateProducts,
        excludedProducts,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "product_rates_stats_failed" });
    }
  });

  app.get("/api/shop/admin/ctv/product-rates", ...gate, async (req: AuthRequest, res) => {
    try {
      const mainDb = await getDb();
      const shopDb = await getShopDb();
      const settings = await getCtvSettings(shopDb);
      const q = String(req.query.q || "").trim();
      const rateType = String(req.query.rateType || "all").trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));
      const filter: Record<string, unknown> = { deletedAt: null, isActive: { $ne: false } };

      if (rateType === "custom") {
        filter.ctvExcluded = { $ne: true };
        filter.ctvCommissionRate = { $exists: true, $ne: null };
      } else if (rateType === "default") {
        filter.ctvExcluded = { $ne: true };
        filter.$or = [{ ctvCommissionRate: null }, { ctvCommissionRate: { $exists: false } }];
      } else if (rateType === "excluded") {
        filter.ctvExcluded = true;
      }

      if (q) {
        const rx = { $regex: vietLooseRegexSource(q), $options: "i" };
        const qFilter = { $or: [{ ma: rx }, { ten: rx }] };
        if (filter.$or) {
          filter.$and = [qFilter, { $or: filter.$or }];
          delete filter.$or;
        } else {
          filter.$or = qFilter.$or;
        }
      }
      const col = mainDb.collection("aloha_products");
      const total = await col.countDocuments(filter);
      const rows = await col
        .find(filter)
        .project({
          ma: 1,
          ten: 1,
          anh: 1,
          images: 1,
          giaWeb: 1,
          giaBan: 1,
          ctvCommissionRate: 1,
          ctvExcluded: 1,
        })
        .sort({ ma: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      return res.json({
        ok: true,
        total,
        page,
        limit,
        defaultRate: settings.defaultCommissionRate,
        data: rows.map((d) => {
          const rate =
            (d as any).ctvExcluded === true
              ? 0
              : (d as any).ctvCommissionRate != null &&
                  Number.isFinite(Number((d as any).ctvCommissionRate))
                ? Number((d as any).ctvCommissionRate)
                : settings.defaultCommissionRate;
          const anh =
            String((d as any).anh || "").trim() ||
            String(
              (Array.isArray((d as any).images) && (d as any).images[0]) || ""
            ).trim();
          return {
            ma: String((d as any).ma || "").toUpperCase(),
            ten: String((d as any).ten || ""),
            anh,
            gia: Number((d as any).giaWeb ?? (d as any).giaBan) || 0,
            ctvCommissionRate:
              (d as any).ctvCommissionRate != null
                ? Number((d as any).ctvCommissionRate)
                : null,
            ctvExcluded: Boolean((d as any).ctvExcluded),
            effectiveRate: rate,
            rateSource:
              (d as any).ctvExcluded === true
                ? "excluded"
                : (d as any).ctvCommissionRate != null
                  ? "sp"
                  : "shop",
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "list_product_rates_failed" });
    }
  });
}
