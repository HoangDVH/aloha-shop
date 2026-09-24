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
  buildEligiblePeriodPreview,
  lockMonthlyBill,
  markBillPaid,
  resolveRate,
  voidUnpaidCommissionsForCtv,
  clearCommissionFraudFlag,
  confirmCommissionFraud,
  clearSoftPhoneRepeatFlags,
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
      const q = String(req.query.q || "").trim();
      const period = String(req.query.period || "").trim();
      const fromYmd = String(req.query.from || "").trim();
      const toYmd = String(req.query.to || "").trim();
      const inBill = req.query.inBill === "1" || req.query.inBill === "true";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const filter: Record<string, unknown> = {};
      if (status) {
        if (status.includes(",")) {
          filter.status = { $in: status.split(",").map((s) => s.trim()).filter(Boolean) };
        } else {
          filter.status = status;
        }
      }
      if (ctvCode) filter.ctvCode = ctvCode;

      const ymdOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (ymdOk(fromYmd) && ymdOk(toYmd)) {
        const [fy, fm, fd] = fromYmd.split("-").map(Number);
        const [ty, tm, td] = toYmd.split("-").map(Number);
        const fromIso = new Date(fy, fm - 1, fd).toISOString();
        const toIso = new Date(ty, tm - 1, td + 1).toISOString(); // exclusive
        filter.$and = [
          ...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []),
          {
            $or: [
              { eligibleAt: { $gte: fromIso, $lt: toIso } },
              {
                $and: [
                  { $or: [{ eligibleAt: null }, { eligibleAt: { $exists: false } }] },
                  { createdAt: { $gte: fromIso, $lt: toIso } },
                ],
              },
            ],
          },
        ];
      } else {
        const periodMatch = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (periodMatch) {
          const y = Number(periodMatch[1]);
          const mo = Number(periodMatch[2]);
          const cycle = periodMatch[3] as "K1" | "K2" | undefined;
          let pStart: string;
          let pEnd: string;
          if (cycle === "K1") {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
          } else if (cycle === "K2") {
            pStart = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
          } else {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
          }
          if (inBill) {
            filter.billingPeriod = period;
          } else {
            // Kỳ: đã vào bill kỳ này HOẶC (chưa vào bill nào và eligibleAt thuộc phạm vi đợt)
            const unbilledEligibleOr = [
              {
                billingPeriod: { $in: [null, ""] },
                eligibleAt: { $gte: pStart, $lt: pEnd },
              },
              ...(cycle === "K2"
                ? [
                    {
                      status: "eligible",
                      billingPeriod: { $in: [null, ""] },
                      eligibleAt: {
                        $gte: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
                        $lt: pEnd,
                      },
                    },
                  ]
                : []),
            ];

            filter.$and = [
              ...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []),
              {
                $or: [
                  { billingPeriod: period },
                  ...unbilledEligibleOr,
                ],
              },
            ];
          }
        }
      }

      if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = { $regex: escaped, $options: "i" };
        const nameHits = await shopDb
          .collection(SHOP_ACCOUNTS)
          .find({
            roles: "ctv",
            $or: [{ fullName: rx }, { email: rx }, { phone: rx }, { ctvCode: rx }],
          })
          .project({ ctvCode: 1 })
          .limit(80)
          .toArray();
        const nameCodes = [
          ...new Set(
            nameHits
              .map((a) => normalizeCtvCode(String((a as any).ctvCode || "")))
              .filter(Boolean)
          ),
        ];
        const or: Record<string, unknown>[] = [
          { orderCode: rx },
          { ctvCode: rx },
          { ma: rx },
          { productName: rx },
        ];
        if (nameCodes.length) or.push({ ctvCode: { $in: nameCodes } });
        filter.$or = or;
      }
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
            .project({
              code: 1,
              id: 1,
              kvInvoiceCode: 1,
              kvOrderCode: 1,
              legacyCodes: 1,
              createdAt: 1,
            })
            .toArray()
        : [];
      const displayByShopCode = new Map<string, string>();
      const purchasedByShopCode = new Map<string, string>();
      const toIso = (v: unknown): string => {
        if (v == null || v === "") return "";
        if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString();
        const s = String(v);
        const t = new Date(s).getTime();
        return Number.isFinite(t) ? new Date(t).toISOString() : s;
      };
      for (const o of orderDocs) {
        const shop = String((o as any).code || (o as any).id || "").trim();
        const display =
          String((o as any).kvInvoiceCode || "").trim() ||
          String((o as any).kvOrderCode || "").trim() ||
          shop;
        const purchasedAt =
          toIso((o as any).createdAt) || toIso((o as any).createdAtIso);
        if (shop) {
          displayByShopCode.set(shop, display);
          if (purchasedAt) purchasedByShopCode.set(shop, purchasedAt);
        }
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) {
            displayByShopCode.set(L, display);
            if (purchasedAt) purchasedByShopCode.set(L, purchasedAt);
          }
        }
        const kvInv = String((o as any).kvInvoiceCode || "").trim();
        const kvOrd = String((o as any).kvOrderCode || "").trim();
        if (kvInv && purchasedAt) purchasedByShopCode.set(kvInv, purchasedAt);
        if (kvOrd && purchasedAt) purchasedByShopCode.set(kvOrd, purchasedAt);
        if (kvInv) displayByShopCode.set(kvInv, display || kvInv);
        if (kvOrd) displayByShopCode.set(kvOrd, display || kvOrd);
      }

      const ctvCodesOnPage = [
        ...new Set(
          rows
            .map((r) => normalizeCtvCode(String((r as any).ctvCode || "")))
            .filter(Boolean)
        ),
      ];
      const accDocs = ctvCodesOnPage.length
        ? await shopDb
            .collection(SHOP_ACCOUNTS)
            .find({ ctvCode: { $in: ctvCodesOnPage } })
            .project({ ctvCode: 1, fullName: 1, displayName: 1 })
            .toArray()
        : [];
      const nameByCtv = new Map<string, string>();
      for (const a of accDocs) {
        const code = normalizeCtvCode(String((a as any).ctvCode || ""));
        if (!code) continue;
        const name =
          String((a as any).fullName || "").trim() ||
          String((a as any).displayName || "").trim();
        if (name) nameByCtv.set(code, name);
      }
      const clickDocs = ctvCodesOnPage.length
        ? await shopDb
            .collection("aloha_shop_ctv_clicks")
            .find({ ctv: { $in: ctvCodesOnPage } })
            .sort({ createdAt: -1 })
            .limit(Math.min(3000, Math.max(200, ctvCodesOnPage.length * 80)))
            .project({ ctv: 1, ma: 1, createdAt: 1, createdAtIso: 1 })
            .toArray()
        : [];
      type ClickHit = { ma: string; at: string; t: number };
      const clicksByCtv = new Map<string, ClickHit[]>();
      for (const c of clickDocs) {
        const ctv = normalizeCtvCode(String((c as any).ctv || ""));
        const at =
          toIso((c as any).createdAtIso) || toIso((c as any).createdAt);
        const t = new Date(at).getTime();
        if (!ctv || !at || !Number.isFinite(t)) continue;
        const arr = clicksByCtv.get(ctv) || [];
        arr.push({
          ma: String((c as any).ma || "")
            .trim()
            .toUpperCase(),
          at,
          t,
        });
        clicksByCtv.set(ctv, arr);
      }
      for (const arr of clicksByCtv.values()) {
        arr.sort((a, b) => b.t - a.t);
      }
      function pickClickAt(
        ctvCode: string,
        ma: string,
        purchasedAt: string | null
      ): string | null {
        const arr = clicksByCtv.get(ctvCode) || [];
        if (!arr.length) return null;
        const before = purchasedAt
          ? new Date(purchasedAt).getTime()
          : Number.POSITIVE_INFINITY;
        let fallback: string | null = null;
        for (const c of arr) {
          if (Number.isFinite(before) && c.t > before) continue;
          if (ma && c.ma === ma) return c.at;
          if (!fallback) fallback = c.at;
        }
        return fallback;
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

      let periodCounts:
        | {
            inBill: number;
            inBillSum: number;
            eligible: number;
            eligibleSum: number;
            all: number;
            allSum: number;
          }
        | undefined;

      if (ctvCode && period) {
        const periodMatch = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (periodMatch) {
          const y = Number(periodMatch[1]);
          const mo = Number(periodMatch[2]);
          const cycle = periodMatch[3] as "K1" | "K2" | undefined;
          let pStart: string;
          let pEnd: string;
          let eligibleQuery: Record<string, unknown>;
          if (cycle === "K1") {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
            eligibleQuery = { eligibleAt: { $gte: pStart, $lt: pEnd } };
          } else if (cycle === "K2") {
            pStart = new Date(Date.UTC(y, mo - 1, 16)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
            // Đợt 2: gom đơn từ ngày 01 đến hết tháng thuộc cùng tháng yyyy-mm còn sót
            eligibleQuery = {
              eligibleAt: {
                $gte: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
                $lt: pEnd,
              },
            };
          } else {
            pStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
            pEnd = new Date(Date.UTC(y, mo, 1)).toISOString();
            eligibleQuery = { eligibleAt: { $gte: pStart, $lt: pEnd } };
          }

          const [inBillAgg, eligibleAgg, allAgg] = await Promise.all([
            col
              .aggregate([
                {
                  $match: {
                    ctvCode,
                    $or: [
                      { billingPeriod: period },
                      { status: { $in: ["billed", "paid_out"] }, billingPeriod: period },
                    ],
                  },
                },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
              ])
              .toArray(),
            col
              .aggregate([
                {
                  $match: {
                    ctvCode,
                    status: "eligible",
                    billingPeriod: { $in: [null, ""] },
                    ...eligibleQuery,
                  },
                },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
              ])
              .toArray(),
            col
              .aggregate([
                {
                  $match: {
                    ctvCode,
                    $or: [
                      { billingPeriod: period },
                      {
                        billingPeriod: { $in: [null, ""] },
                        eligibleAt: { $gte: pStart, $lt: pEnd },
                      },
                      ...(cycle === "K2"
                        ? [
                            {
                              status: "eligible",
                              billingPeriod: { $in: [null, ""] },
                              eligibleAt: {
                                $gte: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
                                $lt: pEnd,
                              },
                            },
                          ]
                        : []),
                    ],
                  },
                },
                { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$amount" } } },
              ])
              .toArray(),
          ]);

          periodCounts = {
            inBill: Number(inBillAgg[0]?.count) || 0,
            inBillSum: Number(inBillAgg[0]?.sum) || 0,
            eligible: Number(eligibleAgg[0]?.count) || 0,
            eligibleSum: Number(eligibleAgg[0]?.sum) || 0,
            all: Number(allAgg[0]?.count) || 0,
            allSum: Number(allAgg[0]?.sum) || 0,
          };
        }
      }

      return res.json({
        ok: true,
        total,
        page,
        limit,
        sums: {
          eligible: Number(sumEligible[0]?.t) || 0,
          held: Number(sumHeld[0]?.t) || 0,
        },
        periodCounts,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          const shopCode = String(rest.orderCode || "").trim();
          const ctvCode = normalizeCtvCode(String(rest.ctvCode || ""));
          const ma = String(rest.ma || "")
            .trim()
            .toUpperCase();
          const purchasedAt =
            purchasedByShopCode.get(shopCode) ||
            toIso(rest.orderCreatedAt) ||
            null;
          return {
            id: String(_id),
            ...rest,
            ctvName: nameByCtv.get(ctvCode) || "",
            displayOrderCode: displayByShopCode.get(shopCode) || shopCode,
            purchasedAt,
            clickAt: pickClickAt(ctvCode, ma, purchasedAt),
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
        billedCount: Number(billedAgg[0]?.n) || 0,
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
        const built = await buildEligiblePeriodPreview(shopDb, period);
        let preview =
          built.ok
            ? {
                period: built.preview.period,
                ctvLines: built.preview.ctvLines,
                totals: built.preview.totals,
              }
            : null;
        const enrichLines = async (lines: any[]) => {
          const codes = [
            ...new Set(
              lines
                .map((l) => normalizeCtvCode(String(l?.ctvCode || "")))
                .filter(Boolean)
            ),
          ];
          if (!codes.length) return lines;
          const accs = await shopDb
            .collection(SHOP_ACCOUNTS)
            .find({ ctvCode: { $in: codes } })
            .project({ ctvCode: 1, fullName: 1, displayName: 1 })
            .toArray();
          const map = new Map<string, string>();
          for (const a of accs) {
            const c = normalizeCtvCode(String((a as any).ctvCode || ""));
            const n =
              String((a as any).fullName || "").trim() ||
              String((a as any).displayName || "").trim();
            if (c && n) map.set(c, n);
          }
          return lines.map((l) => ({
            ...l,
            ctvName: map.get(normalizeCtvCode(String(l?.ctvCode || ""))) || "",
          }));
        };
        if (preview?.ctvLines) {
          preview = {
            ...preview,
            ctvLines: await enrichLines(preview.ctvLines as any[]),
          };
        }
        if (!bill) {
          return res.json({ ok: true, bill: null, preview });
        }
        const { _id, ...rest } = bill as any;
        if (Array.isArray(rest.ctvLines)) {
          rest.ctvLines = await enrichLines(rest.ctvLines);
        }
        return res.json({ ok: true, bill: rest, preview });
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

  /** Bỏ cờ gian → HH về held/eligible */
  app.post(
    "/api/shop/admin/ctv/commissions/clear-flag",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const result = await clearCommissionFraudFlag(shopDb, {
          id: req.body?.id ? String(req.body.id) : undefined,
          orderCode: req.body?.orderCode
            ? String(req.body.orderCode)
            : undefined,
          ctvCode: req.body?.ctvCode ? String(req.body.ctvCode) : undefined,
          ma: req.body?.ma ? String(req.body.ma) : undefined,
          by: req.auth?.username || "admin",
          note: req.body?.note ? String(req.body.note) : undefined,
        });
        if (!result.ok) return res.status(400).json(result);
        return res.json(result);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "clear_flag_failed" });
      }
    }
  );

  /** Xác nhận gian → hủy HH */
  app.post(
    "/api/shop/admin/ctv/commissions/confirm-fraud",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const result = await confirmCommissionFraud(shopDb, {
          id: req.body?.id ? String(req.body.id) : undefined,
          orderCode: req.body?.orderCode
            ? String(req.body.orderCode)
            : undefined,
          ctvCode: req.body?.ctvCode ? String(req.body.ctvCode) : undefined,
          ma: req.body?.ma ? String(req.body.ma) : undefined,
          by: req.auth?.username || "admin",
          reason: req.body?.reason ? String(req.body.reason) : undefined,
        });
        if (!result.ok) return res.status(400).json(result);
        return res.json(result);
      } catch (e: any) {
        return res
          .status(500)
          .json({ error: e?.message || "confirm_fraud_failed" });
      }
    }
  );

  /** Gỡ hàng loạt cờ cũ chỉ do trùng SĐT (không self-buy) */
  app.post(
    "/api/shop/admin/ctv/commissions/clear-soft-flags",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const modified = await clearSoftPhoneRepeatFlags(
          shopDb,
          req.auth?.username || "admin"
        );
        return res.json({ ok: true, modified });
      } catch (e: any) {
        return res
          .status(500)
          .json({ error: e?.message || "clear_soft_failed" });
      }
    }
  );

  /** Đánh dấu đã xử lý 1 fraud event — body { id, reviewStatus, note } */
  app.post(
    "/api/shop/admin/ctv/fraud/review",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const { ObjectId } = await import("mongodb");
        const id = String(req.body?.id || req.params?.id || "").trim();
        if (!id) return res.status(400).json({ error: "missing_id" });
        let filter: Record<string, unknown>;
        try {
          filter = { _id: new ObjectId(id) };
        } catch {
          filter = { _id: id as any };
        }
        const reviewStatus = String(req.body?.reviewStatus || "dismissed");
        if (!["dismissed", "confirmed", "open"].includes(reviewStatus)) {
          return res.status(400).json({ error: "invalid_status" });
        }
        const now = new Date().toISOString();
        const r = await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).updateOne(
          filter,
          {
            $set: {
              reviewStatus,
              reviewedAt: now,
              reviewedBy: req.auth?.username || "admin",
              reviewNote: String(req.body?.note || "").slice(0, 300),
            },
          }
        );
        if (!r.matchedCount) {
          return res.status(404).json({ error: "fraud_event_not_found" });
        }
        return res.json({ ok: true, modified: r.modifiedCount || 0 });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "review_failed" });
      }
    }
  );

  // Alias cũ (path param) — giữ tương thích
  app.post(
    "/api/shop/admin/ctv/fraud/:id/review",
    ...gate,
    async (req: AuthRequest, res) => {
      req.body = {
        ...(req.body || {}),
        id: String(req.params.id || ""),
        reviewStatus: req.body?.reviewStatus || "dismissed",
        note: req.body?.note || "",
      };
      // Reuse logic by forwarding internally is messy; duplicate thin call:
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const { ObjectId } = await import("mongodb");
        const id = String(req.params.id || "").trim();
        let filter: Record<string, unknown>;
        try {
          filter = { _id: new ObjectId(id) };
        } catch {
          filter = { _id: id as any };
        }
        const reviewStatus = String(req.body?.reviewStatus || "dismissed");
        if (!["dismissed", "confirmed", "open"].includes(reviewStatus)) {
          return res.status(400).json({ error: "invalid_status" });
        }
        const now = new Date().toISOString();
        const r = await shopDb.collection(SHOP_CTV_FRAUD_EVENTS).updateOne(
          filter,
          {
            $set: {
              reviewStatus,
              reviewedAt: now,
              reviewedBy: req.auth?.username || "admin",
              reviewNote: String(req.body?.note || "").slice(0, 300),
            },
          }
        );
        if (!r.matchedCount) {
          return res.status(404).json({ error: "fraud_event_not_found" });
        }
        return res.json({ ok: true, modified: r.modifiedCount || 0 });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "review_failed" });
      }
    }
  );

  app.get("/api/shop/admin/ctv/affiliates/:ctvCode", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      const mainDb = await getDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);

      const ctvCode = normalizeCtvCode(String(req.params.ctvCode || ""));
      if (!isValidCtvCode(ctvCode)) return res.status(400).json({ error: "invalid_ctv" });

      const account = await shopDb.collection(SHOP_ACCOUNTS).findOne({ ctvCode });
      if (!account || !(account as any).roles?.includes?.("ctv")) {
        return res.status(404).json({ error: "ctv_not_found" });
      }

      const period = String(req.query.period || "").trim();
      const fromQ = String(req.query.from || "").trim();
      const toQ = String(req.query.to || "").trim();
      const now = new Date();
      const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
      let from: Date;
      let to: Date;
      let periodKey: string;
      if (ymdRe.test(fromQ) && ymdRe.test(toQ)) {
        const [fy, fm, fd] = fromQ.split("-").map(Number);
        const [ty, tm, td] = toQ.split("-").map(Number);
        from = new Date(fy, fm - 1, fd);
        to = new Date(ty, tm - 1, td + 1);
        periodKey = `${ty}-${String(tm).padStart(2, "0")}`;
      } else {
        const m = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (m) {
          periodKey = period;
          const y = Number(m[1]);
          const mo = Number(m[2]);
          const cycle = m[3] as "K1" | "K2" | undefined;
          if (cycle === "K1") {
            from = new Date(y, mo - 1, 1);
            to = new Date(y, mo - 1, 16);
          } else if (cycle === "K2") {
            from = new Date(y, mo - 1, 16);
            to = new Date(y, mo, 1);
          } else {
            from = new Date(y, mo - 1, 1);
            to = new Date(y, mo, 1);
          }
        } else {
          periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const [y, mNum] = periodKey.split("-").map(Number);
          from = new Date(y, mNum - 1, 1);
          to = new Date(y, mNum, 1);
        }
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      const clicksCol = shopDb.collection("aloha_shop_ctv_clicks");
      const ordersCol = shopDb.collection("aloha_shop_orders");
      const commCol = shopDb.collection(SHOP_COMMISSIONS);
      const billsCol = shopDb.collection(SHOP_COMMISSION_BILLS);

      const useStrictRange = ymdRe.test(fromQ) && ymdRe.test(toQ);
      const clickOr = {
        $or: [
          { createdAt: { $gte: from, $lt: to } },
          { createdAtIso: { $gte: fromIso, $lt: toIso } },
        ],
      };
      const orderOr = {
        $or: [
          { createdAt: { $gte: fromIso, $lt: toIso } },
          { createdAt: { $gte: from, $lt: to } },
        ],
      };
      const commOr = {
        $or: [
          ...(useStrictRange ? [] : [{ billingPeriod: periodKey }]),
          { createdAt: { $gte: fromIso, $lt: toIso } },
          { createdAt: { $gte: from, $lt: to } },
          { deliveredAt: { $gte: fromIso, $lt: toIso } },
        ],
      };

      const [clicksCount, orders, commissions, billDocs] = await Promise.all([
        clicksCol.countDocuments({
          $and: [{ $or: [{ ctv: ctvCode }, { ctvCode }] }, clickOr],
        }),
        ordersCol
          .find({ ctvCodes: ctvCode, ...orderOr })
          .sort({ createdAt: -1 })
          .limit(80)
          .project({
            code: 1,
            total: 1,
            totalPayment: 1,
            orderStatus: 1,
            createdAt: 1,
            orderDetails: 1,
            kvInvoiceCode: 1,
            kvOrderCode: 1,
            legacyCodes: 1,
          })
          .toArray(),
        commCol
          .find({
            ctvCode,
            status: { $nin: ["cancelled"] },
            ...commOr,
          })
          .sort({ createdAt: -1 })
          .limit(100)
          .project({
            amount: 1,
            qty: 1,
            status: 1,
            ma: 1,
            productName: 1,
            imageUrl: 1,
            unitPrice: 1,
            lineTotal: 1,
            orderCode: 1,
            rate: 1,
            createdAt: 1,
            billingPeriod: 1,
          })
          .toArray(),
        billsCol
          .find({
            $or: [{ "ctvLines.ctvCode": ctvCode }, { "lines.ctvCode": ctvCode }],
          })
          .sort({ period: -1 })
          .limit(24)
          .project({
            period: 1,
            status: 1,
            lockedAt: 1,
            paidAt: 1,
            ctvLines: 1,
            lines: 1,
            totals: 1,
          })
          .toArray(),
      ]);

      const activeOrders = orders.filter(
        (o) => String((o as any).orderStatus) !== "huy"
      );

      const needMas = new Set<string>();
      for (const o of activeOrders) {
        const details = Array.isArray((o as any).orderDetails)
          ? (o as any).orderDetails
          : [];
        for (const d of details) {
          if (normalizeCtvCode(String(d?.ctvCode || "")) && normalizeCtvCode(String(d?.ctvCode || "")) !== ctvCode) {
            continue;
          }
          const ma = String(d?.productCode || d?.ma || "")
            .trim()
            .toUpperCase();
          if (ma) needMas.add(ma);
        }
      }
      for (const c of commissions) {
        const ma = String((c as any).ma || "")
          .trim()
          .toUpperCase();
        if (ma) needMas.add(ma);
      }

      const byMa = new Map<string, { anh: string; giaWeb: number; ten: string }>();
      if (needMas.size) {
        const mas = [...needMas];
        const products = await mainDb
          .collection("aloha_products")
          .find({
            deletedAt: null,
            $or: [{ ma: { $in: mas } }, { ma: { $in: mas.map((x) => x.toLowerCase()) } }],
          })
          .project({ ma: 1, ten: 1, anh: 1, images: 1, giaWeb: 1, giaBan: 1, giaChung: 1 })
          .toArray();
        for (const p of products) {
          const ma = String((p as any).ma || "")
            .trim()
            .toUpperCase();
          if (!ma) continue;
          const anh =
            String((p as any).anh || "").trim() ||
            String((Array.isArray((p as any).images) && (p as any).images[0]) || "").trim();
          byMa.set(ma, {
            anh,
            giaWeb:
              Number((p as any).giaWeb) ||
              Number((p as any).giaBan) ||
              Number((p as any).giaChung) ||
              0,
            ten: String((p as any).ten || "").trim(),
          });
        }
      }

      const displayCodeOf = (o: any) =>
        String(o?.kvInvoiceCode || "").trim() ||
        String(o?.kvOrderCode || "").trim() ||
        String(o?.code || "").trim();

      const displayByShopCode = new Map<string, string>();
      for (const o of activeOrders) {
        const display = displayCodeOf(o);
        const shop = String((o as any).code || "").trim();
        if (shop) displayByShopCode.set(shop, display);
        for (const leg of Array.isArray((o as any).legacyCodes)
          ? (o as any).legacyCodes
          : []) {
          const L = String(leg || "").trim();
          if (L) displayByShopCode.set(L, display);
        }
      }

      // Bổ sung map mã KV cho đơn chỉ có trong hoa hồng (không nằm trong list orders kỳ)
      const missingCommCodes = [
        ...new Set(
          commissions
            .map((c: any) => String(c.orderCode || "").trim())
            .filter((c) => c && !displayByShopCode.has(c))
        ),
      ];
      if (missingCommCodes.length) {
        const extraOrders = await ordersCol
          .find({
            $or: [
              { code: { $in: missingCommCodes } },
              { id: { $in: missingCommCodes } },
              { legacyCodes: { $in: missingCommCodes } },
            ],
          })
          .project({ code: 1, id: 1, kvInvoiceCode: 1, kvOrderCode: 1, legacyCodes: 1 })
          .toArray();
        for (const o of extraOrders) {
          const display = displayCodeOf(o);
          const shop = String((o as any).code || (o as any).id || "").trim();
          if (shop) displayByShopCode.set(shop, display);
          for (const leg of Array.isArray((o as any).legacyCodes)
            ? (o as any).legacyCodes
            : []) {
            const L = String(leg || "").trim();
            if (L) displayByShopCode.set(L, display);
          }
        }
      }

      let gmv = 0;
      let commissionTotal = 0;
      const productMap = new Map<
        string,
        {
          ma: string;
          name: string;
          imageUrl?: string;
          price: number;
          orderCount: number;
          qty: number;
        }
      >();

      const orderList = activeOrders.map((o: any) => {
        const total = Number(o.total ?? o.totalPayment) || 0;
        gmv += total;
        const details = Array.isArray(o.orderDetails) ? o.orderDetails : [];
        const myLines = details.filter((d: any) => {
          const code = normalizeCtvCode(String(d?.ctvCode || ""));
          return !code || code === ctvCode;
        });
        for (const d of myLines.length ? myLines : details) {
          const ma = String(d?.productCode || d?.ma || "")
            .trim()
            .toUpperCase();
          if (!ma) continue;
          const cat = byMa.get(ma);
          const qty = Math.max(1, Math.floor(Number(d?.quantity ?? d?.qty) || 1));
          const price =
            Math.max(0, Number(d?.price ?? d?.gia) || 0) || (cat?.giaWeb ?? 0);
          const prev = productMap.get(ma);
          if (!prev) {
            productMap.set(ma, {
              ma,
              name: String(d?.productName || d?.ten || "").trim() || cat?.ten || ma,
              imageUrl: String(d?.imageUrl || "").trim() || cat?.anh || undefined,
              price: cat?.giaWeb || price,
              orderCount: 1,
              qty,
            });
          } else {
            prev.orderCount += 1;
            prev.qty += qty;
          }
        }
        const shopCode = String(o.code || "");
        const displayCode = displayByShopCode.get(shopCode) || displayCodeOf(o) || shopCode;
        return {
          code: shopCode,
          displayCode,
          total,
          orderStatus: String(o.orderStatus || ""),
          createdAt: o.createdAt ? String(o.createdAt) : null,
        };
      });

      const commissionList = commissions.map((c: any, idx: number) => {
        const amount = Number(c.amount) || 0;
        commissionTotal += amount;
        const ma = String(c.ma || "")
          .trim()
          .toUpperCase();
        const cat = ma ? byMa.get(ma) : undefined;
        const shopCode = String(c.orderCode || "");
        const displayCode = displayByShopCode.get(shopCode) || shopCode;
        return {
          id: String(c._id || `${c.orderCode}-${ma}-${idx}`),
          orderCode: shopCode,
          displayOrderCode: displayCode,
          ma,
          productName: String(c.productName || "").trim() || cat?.ten || ma || "Sản phẩm",
          imageUrl: String(c.imageUrl || "").trim() || cat?.anh || undefined,
          amount,
          status: String(c.status || ""),
          createdAt: c.createdAt ? String(c.createdAt) : null,
        };
      });

      const payouts = billDocs
        .map((b: any) => {
          const lines = Array.isArray(b.ctvLines)
            ? b.ctvLines
            : Array.isArray(b.lines)
              ? b.lines
              : [];
          const mine = lines.find(
            (l: any) => normalizeCtvCode(String(l.ctvCode || "")) === ctvCode
          );
          if (!mine) return null;
          return {
            period: String(b.period || ""),
            status: String(b.status || ""),
            amount: Number(mine.net ?? mine.amount ?? mine.commission) || 0,
            orderCount: Number(mine.orderCount) || 0,
            lockedAt: b.lockedAt ? String(b.lockedAt) : null,
            paidAt: b.paidAt ? String(b.paidAt) : null,
          };
        })
        .filter(Boolean);

      const products = [...productMap.values()].sort((a, b) => b.orderCount - a.orderCount);

      const recentHistory = [
        ...orderList.slice(0, 8).map((o) => ({
          type: "order" as const,
          id: o.code,
          label: `Đơn #${o.displayCode || o.code}`,
          amount: o.total,
          badge: "Đơn hàng",
          at: o.createdAt,
        })),
        ...commissionList.slice(0, 8).map((c) => ({
          type: "commission" as const,
          id: c.id,
          label: c.displayOrderCode
            ? `Đơn #${c.displayOrderCode}`
            : c.productName,
          amount: c.amount,
          badge: "Hoa hồng",
          at: c.createdAt,
        })),
      ]
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 10);

      const origin = String(process.env.SHOP_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SHOP_ORIGIN || "")
        .trim()
        .replace(/\/$/, "");
      const referralPath = `/?ctv=${encodeURIComponent(ctvCode)}`;
      const referralUrl = origin ? `${origin}${referralPath}` : referralPath;

      return res.json({
        ok: true,
        period: periodKey,
        account: toPublicShopAccount(account),
        referralUrl,
        metrics: {
          clicks: clicksCount,
          orders: activeOrders.length,
          revenue: gmv,
          commission: commissionTotal,
        },
        products,
        recentHistory,
        orders: orderList,
        commissions: commissionList,
        payouts,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "affiliate_detail_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/:ctvCode/ban", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const raw = String(req.params.ctvCode || "").trim().toLowerCase();
      // Tránh nuốt nhầm path tĩnh (fraud/commissions/settings…)
      if (
        ["fraud", "commissions", "settings", "bills", "stats", "overview", "overrides", "product-rates", "affiliates"].includes(
          raw
        )
      ) {
        return res.status(404).json({ error: "not_found" });
      }
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
        severity: "high",
        reviewStatus: "confirmed",
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

  /** Tổng quan dashboard — aggregate thật, không số demo */
  app.get("/api/shop/admin/ctv/overview", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await clearHeldCommissions(shopDb);

      const period = String(req.query.period || "").trim();
      const fromQ = String(req.query.from || "").trim();
      const toQ = String(req.query.to || "").trim();
      const now = new Date();
      const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
      let from: Date;
      let to: Date;
      let periodKey: string;
      if (ymdRe.test(fromQ) && ymdRe.test(toQ)) {
        const [fy, fm, fd] = fromQ.split("-").map(Number);
        const [ty, tm, td] = toQ.split("-").map(Number);
        from = new Date(fy, fm - 1, fd);
        to = new Date(ty, tm - 1, td + 1); // exclusive
        periodKey = `${ty}-${String(tm).padStart(2, "0")}`;
      } else {
        const m = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
        if (m) {
          periodKey = period;
          const y = Number(m[1]);
          const mo = Number(m[2]);
          const cycle = m[3] as "K1" | "K2" | undefined;
          if (cycle === "K1") {
            from = new Date(y, mo - 1, 1);
            to = new Date(y, mo - 1, 16);
          } else if (cycle === "K2") {
            from = new Date(y, mo - 1, 16);
            to = new Date(y, mo, 1);
          } else {
            from = new Date(y, mo - 1, 1);
            to = new Date(y, mo, 1);
          }
        } else {
          periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const [y, mNum] = periodKey.split("-").map(Number);
          from = new Date(y, mNum - 1, 1);
          to = new Date(y, mNum, 1);
        }
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const rangeMs = Math.max(1, to.getTime() - from.getTime());
      const prevTo = from;
      const prevFrom = new Date(prevTo.getTime() - rangeMs);
      const prevFromIso = prevFrom.toISOString();
      const prevToIso = prevTo.toISOString();
      const prevPeriodKey = `${prevFrom.getFullYear()}-${String(prevFrom.getMonth() + 1).padStart(2, "0")}`;

      const acc = shopDb.collection(SHOP_ACCOUNTS);
      const col = shopDb.collection(SHOP_COMMISSIONS);
      const clicks = shopDb.collection("aloha_shop_ctv_clicks");

      // Range tùy ý: chỉ theo ngày. Kỳ tháng: thêm khớp billingPeriod.
      const useStrictRange = ymdRe.test(fromQ) && ymdRe.test(toQ);
      const periodMatch = (fromIsoX: string, toIsoX: string, periodX: string) => ({
        status: { $nin: ["cancelled"] },
        $or: [
          ...(useStrictRange ? [] : [{ billingPeriod: periodX }]),
          { deliveredAt: { $gte: fromIsoX, $lt: toIsoX } },
          { createdAtIso: { $gte: fromIsoX, $lt: toIsoX } },
          { createdAt: { $gte: fromIsoX, $lt: toIsoX } },
        ],
      });

      const [
        ctvTotal,
        ctvActive,
        clicksInPeriod,
        clicksPrev,
        gmvAgg,
        gmvPrevAgg,
        payableAgg,
        commissionByStatus,
        topAgg,
        dailyAgg,
      ] = await Promise.all([
        acc.countDocuments({ roles: "ctv" }),
        acc.countDocuments({ roles: "ctv", ctvStatus: "active" }),
        clicks.countDocuments({
          $or: [
            { createdAt: { $gte: from, $lt: to } },
            { createdAtIso: { $gte: fromIso, $lt: toIso } },
          ],
        }),
        clicks.countDocuments({
          $or: [
            { createdAt: { $gte: prevFrom, $lt: prevTo } },
            { createdAtIso: { $gte: prevFromIso, $lt: prevToIso } },
          ],
        }),
        col
          .aggregate([
            { $match: periodMatch(fromIso, toIso, periodKey) },
            {
              $group: {
                _id: null,
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
                orders: { $addToSet: "$orderCode" },
              },
            },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: periodMatch(prevFromIso, prevToIso, prevPeriodKey) },
            {
              $group: {
                _id: null,
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
                orders: { $addToSet: "$orderCode" },
              },
            },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: { status: { $in: ["held", "eligible", "billed"] } } },
            { $group: { _id: null, t: { $sum: "$amount" } } },
          ])
          .toArray(),
        col
          .aggregate([
            {
              $group: {
                _id: "$status",
                amount: { $sum: "$amount" },
                n: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: periodMatch(fromIso, toIso, periodKey) },
            {
              $group: {
                _id: "$ctvCode",
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
                orders: { $addToSet: "$orderCode" },
              },
            },
            { $sort: { gmv: -1 } },
            { $limit: 10 },
          ])
          .toArray(),
        col
          .aggregate([
            { $match: periodMatch(fromIso, toIso, periodKey) },
            {
              $addFields: {
                dayKey: {
                  $substr: [
                    {
                      $ifNull: [
                        "$deliveredAt",
                        { $ifNull: ["$createdAtIso", ""] },
                      ],
                    },
                    0,
                    10,
                  ],
                },
              },
            },
            { $match: { dayKey: { $regex: /^\d{4}-\d{2}-\d{2}$/ } } },
            {
              $group: {
                _id: "$dayKey",
                gmv: { $sum: "$lineTotal" },
                commission: { $sum: "$amount" },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray(),
      ]);

      const pctChange = (cur: number, prev: number) => {
        if (!prev && !cur) return null;
        if (!prev) return cur > 0 ? 100 : null;
        return Math.round(((cur - prev) / prev) * 1000) / 10;
      };

      const gmvInPeriod = Number(gmvAgg[0]?.gmv) || 0;
      const commissionInPeriod = Number(gmvAgg[0]?.commission) || 0;
      const ordersInPeriod = Array.isArray(gmvAgg[0]?.orders)
        ? gmvAgg[0].orders.length
        : 0;
      const gmvPrev = Number(gmvPrevAgg[0]?.gmv) || 0;
      const ordersPrev = Array.isArray(gmvPrevAgg[0]?.orders)
        ? gmvPrevAgg[0].orders.length
        : 0;
      const commissionPrev = Number(gmvPrevAgg[0]?.commission) || 0;

      const statusMap: Record<string, { amount: number; n: number }> = {};
      for (const r of commissionByStatus) {
        statusMap[String(r._id || "")] = {
          amount: Number(r.amount) || 0,
          n: Number(r.n) || 0,
        };
      }

      const topCodes = topAgg
        .map((r: any) => normalizeCtvCode(String(r._id || "")))
        .filter(Boolean);
      const topAccounts = topCodes.length
        ? await acc
            .find({ ctvCode: { $in: topCodes } })
            .project({ ctvCode: 1, fullName: 1, avatarUrl: 1, ctvStatus: 1 })
            .toArray()
        : [];
      const topAccByCode = new Map(
        topAccounts.map((a: any) => [
          normalizeCtvCode(String(a.ctvCode || "")),
          a,
        ])
      );

      return res.json({
        ok: true,
        period: periodKey,
        prevPeriod: prevPeriodKey,
        ctvTotal,
        ctvActive,
        clicksInPeriod,
        ordersInPeriod,
        gmvInPeriod,
        commissionInPeriod,
        payableAmount: Number(payableAgg[0]?.t) || 0,
        changes: {
          clicks: pctChange(clicksInPeriod, clicksPrev),
          orders: pctChange(ordersInPeriod, ordersPrev),
          gmv: pctChange(gmvInPeriod, gmvPrev),
          commission: pctChange(commissionInPeriod, commissionPrev),
        },
        commissionByStatus: statusMap,
        daily: dailyAgg.map((r: any) => ({
          day: String(r._id || ""),
          gmv: Number(r.gmv) || 0,
          commission: Number(r.commission) || 0,
        })),
        topCtv: topAgg.map((r: any) => {
          const code = normalizeCtvCode(String(r._id || ""));
          const a = topAccByCode.get(code) as any;
          return {
            ctvCode: code,
            fullName: String(a?.fullName || "").trim() || code,
            avatarUrl: String(a?.avatarUrl || "").trim() || null,
            ctvStatus: a?.ctvStatus ? String(a.ctvStatus) : null,
            gmv: Number(r.gmv) || 0,
            commission: Number(r.commission) || 0,
            orderCount: Array.isArray(r.orders) ? r.orders.length : 0,
          };
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "overview_failed" });
    }
  });

  /** Xuất Excel chi kỳ — sheet ChiHH + ThieuSTK */
  app.get(
    "/api/shop/admin/ctv/bills/:period/export.xlsx",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const period = String(req.params.period || "").trim();
        if (!/^\d{4}-\d{2}(-K[12])?$/.test(period)) {
          return res.status(400).json({ error: "invalid_period" });
        }
        const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({
          period,
        });
        if (!bill) return res.status(404).json({ error: "bill_not_found" });
        const status = String((bill as any).status || "");
        if (status !== "locked" && status !== "paid") {
          return res.status(400).json({ error: "bill_not_locked" });
        }

        const lines = Array.isArray((bill as any).ctvLines)
          ? (bill as any).ctvLines
          : [];
        const codes = lines
          .map((l: any) => normalizeCtvCode(String(l.ctvCode || "")))
          .filter(Boolean);
        const accounts = await shopDb
          .collection(SHOP_ACCOUNTS)
          .find({ ctvCode: { $in: codes } })
          .project({
            ctvCode: 1,
            fullName: 1,
            phone: 1,
            payoutBank: 1,
            ctvBalanceDebt: 1,
          })
          .toArray();
        const byCode = new Map(
          accounts.map((a) => [normalizeCtvCode(String((a as any).ctvCode)), a])
        );

        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = "ALOHA Shop";
        const sheet = wb.addWorksheet("ChiHH");
        sheet.columns = [
          { header: "ctvCode", key: "ctvCode", width: 16 },
          { header: "fullName", key: "fullName", width: 24 },
          { header: "phone", key: "phone", width: 14 },
          { header: "bankName", key: "bankName", width: 22 },
          { header: "bankBin", key: "bankBin", width: 12 },
          { header: "accountNumber", key: "accountNumber", width: 18 },
          { header: "accountName", key: "accountName", width: 24 },
          { header: "gross", key: "gross", width: 14 },
          { header: "adjustments", key: "adjustments", width: 14 },
          { header: "net", key: "net", width: 14 },
          { header: "orderCount", key: "orderCount", width: 12 },
          { header: "debt", key: "debt", width: 12 },
          { header: "missingStk", key: "missingStk", width: 12 },
        ];
        const missing: any[] = [];
        for (const line of lines) {
          const code = normalizeCtvCode(String(line.ctvCode || ""));
          const acc = byCode.get(code) as any;
          const pb = acc?.payoutBank || {};
          const hasStk = Boolean(String(pb.accountNumber || "").trim());
          const row = {
            ctvCode: code,
            fullName: String(acc?.fullName || ""),
            phone: String(acc?.phone || ""),
            bankName: String(pb.bankName || ""),
            bankBin: String(pb.bankBin || ""),
            accountNumber: String(pb.accountNumber || ""),
            accountName: String(pb.accountName || ""),
            gross: Number(line.gross) || 0,
            adjustments: Number(line.adjustments) || 0,
            net: Number(line.net) || 0,
            orderCount: Number(line.orderCount) || 0,
            debt: Number(acc?.ctvBalanceDebt) || 0,
            missingStk: hasStk ? "" : "1",
          };
          sheet.addRow(row);
          if (!hasStk) missing.push(row);
        }
        const missSheet = wb.addWorksheet("ThieuSTK");
        missSheet.columns = sheet.columns;
        for (const row of missing) missSheet.addRow(row);

        await shopDb.collection(SHOP_COMMISSION_BILLS).updateOne(
          { period },
          {
            $set: {
              exportedAt: new Date().toISOString(),
              exportedBy: req.auth?.username || "admin",
              updatedAt: new Date().toISOString(),
            },
          }
        );

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="ChiHH-${period}.xlsx"`
        );
        await wb.xlsx.write(res);
        res.end();
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "export_failed" });
      }
    }
  );
}
