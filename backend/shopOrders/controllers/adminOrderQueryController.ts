import type { Response } from "express";
import type { Db } from "mongodb";
import type { AuthRequest, GetDb } from "../../auth/middleware.js";
import { SHOP_ORDERS, ensureShopOrderIndexes } from "../models.js";
import { expireUnpaidShopOrders } from "../markPaid.js";
import { checkStoredWholesaleOrder } from "../../shopWholesale/orderPurchaseCheck.js";
import { voidTestBlockReason } from "../voidTestOrder.js";
import type { GetShopDb } from "../routes.js";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function ensureAdminOrderIndexes(shopDb: Db, state: { ready: boolean }) {
  if (state.ready) return;
  await ensureShopOrderIndexes(shopDb);
  state.ready = true;
}

export async function handleGetAdminOrders(
  req: AuthRequest,
  res: Response,
  getDb: GetDb,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    const mainDb = await getDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
    await expireUnpaidShopOrders(shopDb, mainDb);

    const status = String(req.query.shipmentStatus || "").trim();
    const paymentStatus = String(req.query.paymentStatus || "").trim();
    const method = String(req.query.method || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const filter: Record<string, unknown> = {};

    if (status === "pending") filter["shipment.status"] = "pending";
    else if (status === "created") filter["shipment.status"] = "created";
    else if (status === "failed") filter["shipment.status"] = "failed";
    if (method) filter.method = method;

    if (paymentStatus === "pending") {
      filter.$or = [
        { paymentStatus: { $in: ["unpaid", "cod", "processing", "failed", "underpaid"] } },
        { "paymentReview.needed": true },
      ];
    } else if (paymentStatus === "review" || paymentStatus === "needs_staff") {
      filter.$and = [
        { paymentStatus: { $nin: ["paid", "cancelled"] } },
        {
          $or: [
            { paymentStatus: "underpaid" },
            { "paymentReview.needed": true },
            {
              customerReportedPaidAt: {
                $exists: true,
                $nin: [null, ""],
              },
            },
          ],
        },
      ];
    } else if (paymentStatus.includes(",")) {
      filter.paymentStatus = {
        $in: paymentStatus
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    } else if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    const priceMode = String(req.query.priceMode || "").trim();
    if (priceMode === "si") {
      filter.priceMode = "si";
    } else if (priceMode === "le" || priceMode === "web") {
      filter.priceMode = { $ne: "si" };
    }

    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();
    if (fromDate || toDate) {
      const gteIso = fromDate ? new Date(fromDate).toISOString() : null;
      const lteIso = toDate ? new Date(toDate).toISOString() : null;
      const dateOrList: any[] = [];
      if (gteIso && lteIso) {
        dateOrList.push(
          { createdAt: { $gte: gteIso, $lte: lteIso } },
          { createdAt: { $gte: new Date(gteIso), $lte: new Date(lteIso) } }
        );
      } else if (gteIso) {
        dateOrList.push(
          { createdAt: { $gte: gteIso } },
          { createdAt: { $gte: new Date(gteIso) } }
        );
      } else if (lteIso) {
        dateOrList.push(
          { createdAt: { $lte: lteIso } },
          { createdAt: { $lte: new Date(lteIso) } }
        );
      }
      if (dateOrList.length) {
        filter.$and = [...((filter.$and as unknown[]) || []), { $or: dateOrList }];
      }
    }

    const q = String(req.query.q || "").trim().slice(0, 50);
    const searchType = String(req.query.searchType || "code").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      if (searchType === "product") {
        filter.$and = [
          ...((filter.$and as unknown[]) || []),
          {
            $or: [
              { "orderDetails.productCode": rx },
              { "orderDetails.productName": rx },
              { "orderDetails.variantLabel": rx },
            ],
          },
        ];
      } else if (searchType === "customer") {
        filter.$and = [
          ...((filter.$and as unknown[]) || []),
          {
            $or: [
              { customerName: rx },
              { customerPhone: rx },
              { "shippingAddress.phone": rx },
              { "shippingAddress.fullName": rx },
            ],
          },
        ];
      } else if (searchType === "note") {
        filter.$and = [
          ...((filter.$and as unknown[]) || []),
          {
            $or: [
              { customerNote: rx },
              { notes: rx },
              { reviewNote: rx },
              { "orderDetails.note": rx },
            ],
          },
        ];
      } else {
        filter.$and = [
          ...((filter.$and as unknown[]) || []),
          { $or: [{ code: rx }, { kvOrderCode: rx }, { kvInvoiceCode: rx }, { legacyCodes: rx }] },
        ];
      }
    }

    const col = shopDb.collection(SHOP_ORDERS);
    const total = await col.countDocuments(filter);
    const rows = await col
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const needMas = new Set<string>();
    for (const row of rows) {
      const details = Array.isArray((row as any).orderDetails) ? (row as any).orderDetails : [];
      for (const d of details) {
        const ma = String(d?.productCode || d?.ma || "").trim().toUpperCase();
        if (ma) needMas.add(ma);
      }
    }
    const productMetaByMa = new Map<string, { anh: string; giaWeb: number; giaSi: number }>();
    if (needMas.size) {
      const docs = await mainDb
        .collection("aloha_products")
        .find({
          deletedAt: null,
          $or: [
            { ma: { $in: [...needMas] } },
            { ma: { $in: [...needMas].map((m) => m.toLowerCase()) } },
          ],
        })
        .project({ ma: 1, anh: 1, images: 1, giaWeb: 1, giaSi: 1, giaBan: 1, giaChung: 1 })
        .toArray();
      for (const d of docs) {
        const ma = String((d as any).ma || "").trim().toUpperCase();
        const anh = String((d as any).anh || "").trim();
        const imgs = Array.isArray((d as any).images) ? (d as any).images : [];
        const firstImg = anh || String(imgs[0] || "").trim();
        const giaWeb = Number((d as any).giaWeb || (d as any).giaBan || (d as any).giaChung || 0);
        const giaSi = Number((d as any).giaSi || 0);
        if (ma) productMetaByMa.set(ma, { anh: firstImg, giaWeb, giaSi });
      }
    }

    let summary = { count: total, totalRevenue: 0, totalPaid: 0 };
    try {
      const summaryAgg = await col
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$total" },
              totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } },
            },
          },
        ])
        .toArray();
      if (summaryAgg && summaryAgg[0]) {
        summary.totalRevenue = Number(summaryAgg[0].totalRevenue) || 0;
        summary.totalPaid = Number(summaryAgg[0].totalPaid) || 0;
      }
    } catch {
      /* ignore aggregation error, fall back to default */
    }

    return res.json({
      ok: true,
      total,
      page,
      limit,
      summary,
      data: rows.map((d) => {
        const { _id, ...rest } = d as Record<string, unknown>;
        const details = Array.isArray(rest.orderDetails)
          ? (rest.orderDetails as any[]).map((it) => {
              const ma = String(it?.productCode || it?.ma || "").trim().toUpperCase();
              const meta = productMetaByMa.get(ma);
              const imageUrl =
                String(it?.imageUrl || it?.anh || "").trim() || meta?.anh || "";
              const giaWeb = meta?.giaWeb || 0;
              const giaSi = meta?.giaSi || 0;
              const price = Number(it?.price) || 0;
              const priceKind =
                it?.priceKind ||
                (rest.priceMode === "si" || (giaSi > 0 && price === giaSi)
                  ? "si"
                  : "web");
              return {
                ...it,
                productCode: ma || it?.productCode,
                imageUrl: imageUrl || undefined,
                giaWeb,
                giaSi,
                priceKind,
              };
            })
          : rest.orderDetails;
        return { ...rest, orderDetails: details, voidTestBlock: voidTestBlockReason(rest) };
      }),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Lỗi tải đơn web" });
  }
}

export async function handleGetAdminOrderById(
  req: AuthRequest,
  res: Response,
  getDb: GetDb,
  getShopDb: GetShopDb,
  idxState: { ready: boolean }
) {
  try {
    const shopDb = await getShopDb();
    await ensureAdminOrderIndexes(shopDb, idxState);
    const id = String(req.params.id || "").trim();
    const doc = await shopDb.collection(SHOP_ORDERS).findOne({
      $or: [{ id }, { code: id }],
    });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy đơn" });
    const { _id, ...rest } = doc as Record<string, unknown>;
    const wholesaleEligibilityNow = await checkStoredWholesaleOrder(shopDb, await getDb(), doc);
    return res.json({ ok: true, data: { ...rest, wholesaleEligibilityNow } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Lỗi" });
  }
}
