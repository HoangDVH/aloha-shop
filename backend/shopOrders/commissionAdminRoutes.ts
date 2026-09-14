/**
 * API admin CTV hoa hồng + settings + rates + bills + fraud.
 */
import type { Express, Response } from "express";
import type { Db } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import {
  SHOP_ACCOUNTS,
  isValidCtvCode,
  normalizeCtvCode,
  toPublicShopAccount,
} from "../shopAuth/models.js";
import type { GetShopDb } from "./routes.js";
import {
  ensureCommissionIndexes,
  getCtvSettings,
  saveCtvSettings,
  SHOP_COMMISSIONS,
  SHOP_COMMISSION_BILLS,
  SHOP_CTV_PRODUCT_RATES,
  SHOP_CTV_FRAUD_EVENTS,
} from "./commissionModels.js";
import {
  clearHeldCommissions,
  lockMonthlyBill,
  markBillPaid,
  resolveRate,
  voidUnpaidCommissionsForCtv,
} from "./commission.js";
import { recordFraudEvent } from "./ctvFraud.js";

/**
 * Regex khớp tên/mã không phân biệt dấu tiếng Việt (giống Hàng hóa).
 * Gõ «kim tien» vẫn ra «Kim Tiền».
 */
function vietLooseRegexSource(raw: string): string {
  const foldMap: Record<string, string> = {
    a: "[aàáảãạăằắẳẵặâầấẩẫậAÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]",
    e: "[eèéẻẽẹêềếểễệEÈÉẺẼẸÊỀẾỂỄỆ]",
    i: "[iìíỉĩịIÌÍỈĨỊ]",
    o: "[oòóỏõọôồốổỗộơờớởỡợOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]",
    u: "[uùúủũụưừứửữựUÙÚỦŨỤƯỪỨỬỮỰ]",
    y: "[yỳýỷỹỵYỲÝỶỸỴ]",
    d: "[dđDĐ]",
  };
  const s = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  let out = "";
  for (const ch of s) {
    if (foldMap[ch]) out += foldMap[ch];
    else if (/[.*+?^${}()|[\]\\]/.test(ch)) out += "\\" + ch;
    else out += ch;
  }
  return out;
}

export function registerShopCommissionAdminRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];
  let ready = false;
  const ensure = async (db: Db) => {
    if (ready) return;
    await ensureCommissionIndexes(db);
    ready = true;
  };

  app.get("/api/shop/admin/ctv/settings", ...gate, async (_req, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const settings = await getCtvSettings(shopDb);
      return res.json({ ok: true, settings });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "settings_failed" });
    }
  });

  app.patch("/api/shop/admin/ctv/settings", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const settings = await saveCtvSettings(shopDb, req.body || {});
      return res.json({ ok: true, settings });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "settings_save_failed" });
    }
  });

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
      return res.json({ ok: true, updated });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "product_rates_failed" });
    }
  });

  app.get("/api/shop/admin/ctv/product-rates", ...gate, async (req: AuthRequest, res) => {
    try {
      const mainDb = await getDb();
      const shopDb = await getShopDb();
      const settings = await getCtvSettings(shopDb);
      const q = String(req.query.q || "").trim();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));
      const filter: Record<string, unknown> = { deletedAt: null, isActive: { $ne: false } };
      if (q) {
        const rx = { $regex: vietLooseRegexSource(q), $options: "i" };
        filter.$or = [{ ma: rx }, { ten: rx }];
      }
      const col = mainDb.collection("aloha_products");
      const total = await col.countDocuments(filter);
      const rows = await col
        .find(filter)
        .project({
          ma: 1,
          ten: 1,
          anh: 1,
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
          return {
            ma: String((d as any).ma || "").toUpperCase(),
            ten: String((d as any).ten || ""),
            anh: String((d as any).anh || ""),
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

  /** Override CTV–SP */
  app.get("/api/shop/admin/ctv/overrides", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const ctvCode = normalizeCtvCode(String(req.query.ctvCode || ""));
      if (!isValidCtvCode(ctvCode)) return res.status(400).json({ error: "invalid_ctv" });
      const rows = await shopDb
        .collection(SHOP_CTV_PRODUCT_RATES)
        .find({ ctvCode })
        .sort({ updatedAt: -1 })
        .limit(200)
        .toArray();
      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          return rest;
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "overrides_failed" });
    }
  });

  app.put("/api/shop/admin/ctv/overrides", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      const mainDb = await getDb();
      await ensure(shopDb);
      const ctvCode = normalizeCtvCode(String(req.body?.ctvCode || ""));
      const ma = String(req.body?.ma || "").trim().toUpperCase();
      const rate = Math.max(0, Number(req.body?.rate) || 0);
      if (!isValidCtvCode(ctvCode) || !ma) {
        return res.status(400).json({ error: "invalid_ctv_or_ma" });
      }
      const base = await resolveRate(shopDb, mainDb, ctvCode, ma);
      // Target ≥ open (bỏ qua nếu base từ ctv_sp cũ)
      const openRate =
        base.source === "ctv_sp"
          ? (await getCtvSettings(shopDb)).defaultCommissionRate
          : base.rate;
      if (rate + 1e-9 < openRate) {
        return res.status(400).json({
          error: `rate_below_open`,
          message: `% CTV đặc biệt phải ≥ % đang mở (${openRate}%)`,
          openRate,
        });
      }
      const now = new Date().toISOString();
      await shopDb.collection(SHOP_CTV_PRODUCT_RATES).updateOne(
        { ctvCode, ma },
        { $set: { ctvCode, ma, rate, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      return res.json({ ok: true, ctvCode, ma, rate });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "override_save_failed" });
    }
  });

  app.delete("/api/shop/admin/ctv/overrides", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      const ctvCode = normalizeCtvCode(String(req.body?.ctvCode || req.query.ctvCode || ""));
      const ma = String(req.body?.ma || req.query.ma || "")
        .trim()
        .toUpperCase();
      if (!ctvCode || !ma) return res.status(400).json({ error: "missing" });
      await shopDb.collection(SHOP_CTV_PRODUCT_RATES).deleteOne({ ctvCode, ma });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "override_del_failed" });
    }
  });

  app.get("/api/shop/admin/ctv/commissions", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);
      const status = String(req.query.status || "").trim();
      const ctvCode = normalizeCtvCode(String(req.query.ctvCode || ""));
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (ctvCode) filter.ctvCode = ctvCode;
      const col = shopDb.collection(SHOP_COMMISSIONS);
      const total = await col.countDocuments(filter);
      const rows = await col
        .find(filter)
        .sort({ eligibleAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      const orderCodes = [
        ...new Set(
          rows
            .map((r) => String((r as any).orderCode || "").trim())
            .filter(Boolean)
        ),
      ];
      const orderDocs = orderCodes.length
        ? await shopDb
            .collection("aloha_shop_orders")
            .find({
              $or: [
                { code: { $in: orderCodes } },
                { id: { $in: orderCodes } },
                { legacyCodes: { $in: orderCodes } },
              ],
            })
            .project({ code: 1, id: 1, kvInvoiceCode: 1, kvOrderCode: 1, legacyCodes: 1 })
            .toArray()
        : [];
      const displayByShopCode = new Map<string, string>();
      for (const o of orderDocs) {
        const shop = String((o as any).code || (o as any).id || "").trim();
        const display =
          String((o as any).kvInvoiceCode || "").trim() ||
          String((o as any).kvOrderCode || "").trim() ||
          shop;
        if (shop) displayByShopCode.set(shop, display);
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) displayByShopCode.set(L, display);
        }
      }
      const sumEligible = await col
        .aggregate([
          { $match: { status: "eligible" } },
          { $group: { _id: null, t: { $sum: "$amount" } } },
        ])
        .toArray();
      const sumHeld = await col
        .aggregate([
          { $match: { status: "held" } },
          { $group: { _id: null, t: { $sum: "$amount" } } },
        ])
        .toArray();
      return res.json({
        ok: true,
        total,
        page,
        limit,
        sums: {
          eligible: Number(sumEligible[0]?.t) || 0,
          held: Number(sumHeld[0]?.t) || 0,
        },
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          const shopCode = String(rest.orderCode || "").trim();
          return {
            id: String(_id),
            ...rest,
            displayOrderCode: displayByShopCode.get(shopCode) || shopCode,
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "commissions_failed" });
    }
  });

  app.get("/api/shop/admin/ctv/stats", ...gate, async (_req, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);
      const col = shopDb.collection(SHOP_COMMISSIONS);
      const acc = shopDb.collection(SHOP_ACCOUNTS);
      const [
        ctvPending,
        fraudNew,
        heldAgg,
        eligibleAgg,
        billedAgg,
        unlockedBill,
      ] = await Promise.all([
        acc.countDocuments({ roles: "ctv", ctvStatus: "cho_duyet" }),
        shopDb.collection(SHOP_CTV_FRAUD_EVENTS).countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 86400_000).toISOString() },
        }),
        col.aggregate([{ $match: { status: "held" } }, { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
        col.aggregate([{ $match: { status: "eligible" } }, { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
        col.aggregate([{ $match: { status: "billed" } }, { $group: { _id: null, t: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
        shopDb.collection(SHOP_COMMISSION_BILLS).findOne({
          status: { $in: ["draft", "locked"] },
        }),
      ]);
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const periodBill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
      return res.json({
        ok: true,
        ctvPending,
        fraudNew,
        heldAmount: Number(heldAgg[0]?.t) || 0,
        heldCount: Number(heldAgg[0]?.n) || 0,
        eligibleAmount: Number(eligibleAgg[0]?.t) || 0,
        eligibleCount: Number(eligibleAgg[0]?.n) || 0,
        billedAmount: Number(billedAgg[0]?.t) || 0,
        currentPeriod: period,
        currentBillStatus: (periodBill as any)?.status || null,
        hasOpenBill: Boolean(unlockedBill),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "stats_failed" });
    }
  });

  app.get("/api/shop/admin/ctv/bills", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const period = String(req.query.period || "").trim();
      if (period) {
        const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
        if (!bill) return res.json({ ok: true, bill: null });
        const { _id, ...rest } = bill as any;
        return res.json({ ok: true, bill: rest });
      }
      const rows = await shopDb
        .collection(SHOP_COMMISSION_BILLS)
        .find({})
        .sort({ period: -1 })
        .limit(24)
        .toArray();
      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          return rest;
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "bills_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/bills/lock", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const period = String(req.body?.period || "").trim();
      const result = await lockMonthlyBill(
        shopDb,
        period,
        req.auth?.username || "admin"
      );
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error });
      }
      return res.json({ ok: true, bill: result.bill });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "lock_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/bills/:period/mark-paid", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const period = String(req.params.period || "").trim();
      const ctvCode = req.body?.ctvCode
        ? normalizeCtvCode(String(req.body.ctvCode))
        : undefined;
      const result = await markBillPaid(shopDb, period, {
        ctvCode,
        paidBy: req.auth?.username || "admin",
      });
      if (!result.ok) return res.status(400).json(result);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "mark_paid_failed" });
    }
  });

  app.get("/api/shop/admin/ctv/fraud", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const rows = await shopDb
        .collection(SHOP_CTV_FRAUD_EVENTS)
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      const orderCodes = [
        ...new Set(
          rows
            .map((r) => String((r as any).orderCode || "").trim())
            .filter(Boolean)
        ),
      ];
      const orderDocs = orderCodes.length
        ? await shopDb
            .collection("aloha_shop_orders")
            .find({
              $or: [
                { code: { $in: orderCodes } },
                { id: { $in: orderCodes } },
                { legacyCodes: { $in: orderCodes } },
              ],
            })
            .project({ code: 1, id: 1, kvInvoiceCode: 1, kvOrderCode: 1, legacyCodes: 1 })
            .toArray()
        : [];
      const displayByShopCode = new Map<string, string>();
      for (const o of orderDocs) {
        const shop = String((o as any).code || (o as any).id || "").trim();
        const display =
          String((o as any).kvInvoiceCode || "").trim() ||
          String((o as any).kvOrderCode || "").trim() ||
          shop;
        if (shop) displayByShopCode.set(shop, display);
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) displayByShopCode.set(L, display);
        }
      }
      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          const shopCode = String(rest.orderCode || "").trim();
          return {
            id: String(_id),
            ...rest,
            displayOrderCode: shopCode
              ? displayByShopCode.get(shopCode) || shopCode
              : null,
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "fraud_list_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/:ctvCode/ban", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const ctvCode = normalizeCtvCode(String(req.params.ctvCode || ""));
      const reason = String(req.body?.reason || "fraud").slice(0, 200);
      if (!isValidCtvCode(ctvCode)) return res.status(400).json({ error: "invalid_ctv" });
      const now = new Date().toISOString();
      await shopDb.collection(SHOP_ACCOUNTS).updateOne(
        { ctvCode },
        {
          $set: {
            ctvStatus: "khoa",
            lockedReason: reason,
            bannedAt: now,
            updatedAt: now,
          },
        }
      );
      const voided = await voidUnpaidCommissionsForCtv(shopDb, ctvCode, reason);
      await recordFraudEvent(shopDb, {
        type: "manual_ban",
        ctvCode,
        details: [reason],
        by: req.auth?.username || "admin",
      });
      try {
        const { syncBus } = await import("../syncBus.js");
        syncBus.publish(["aloha_shop_ctv_fraud"], "ctv-ban", { ctvCode });
      } catch {
        /* ignore */
      }
      return res.json({ ok: true, voided });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "ban_failed" });
    }
  });
}
