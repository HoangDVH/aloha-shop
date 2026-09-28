/**
 * Bestsellers revenue ranking map calculation.
 */
import type { Db } from "mongodb";
import { cachedJson } from "./cache.js";
import { normalizeMa } from "./text.js";
import { INVOICES_COL } from "./types.js";

/** Cache xếp hạng bán chạy (chỉ key shop:* — không ghi aloha_products). */
export const BESTSELLER_TTL_SEC = 60;
/** Cửa sổ doanh thu gần đây (ngày) — fallback toàn bộ nếu trống. */
export const BESTSELLER_DAYS = 90;
export const HOME_BESTSELLER_FACET_LIMIT = 200;

/**
 * Xếp hạng SP theo doanh thu HĐ bán (qty × giá − CK dòng).
 * CHỈ ĐỌC aloha_sales_invoices — không update sản phẩm / store nội bộ.
 */
export async function loadRevenueRankMap(db: Db): Promise<Map<string, number>> {
  const cacheKey = `shop:bestsellers:revenue:v1:d${BESTSELLER_DAYS}`;
  const { body } = await cachedJson(
    cacheKey,
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - BESTSELLER_DAYS);
      const sinceIso = since.toISOString();

      const cancelRx = /cancel|void|huy|hủy|đã hủy|da huy/i;
      const pipeline = (withDate: boolean) => {
        const match: Record<string, unknown> = {
          isDraft: { $ne: true },
          $and: [
            {
              $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
            },
            {
              $or: [
                { statusValue: { $exists: false } },
                { statusValue: null },
                { statusValue: { $not: cancelRx } },
              ],
            },
            {
              $or: [
                { status: { $exists: false } },
                { status: null },
                { status: { $nin: [3, "3", "Cancelled", "Void"] } },
              ],
            },
          ],
        };
        if (withDate) {
          (match.$and as unknown[]).push({
            $or: [
              { purchaseDate: { $gte: sinceIso } },
              { createdDate: { $gte: sinceIso } },
              { createdAt: { $gte: sinceIso } },
            ],
          });
        }
        return [
          { $match: match },
          {
            $project: {
              lines: {
                $cond: [
                  {
                    $gt: [
                      { $size: { $ifNull: ["$invoiceDetails", []] } },
                      0,
                    ],
                  },
                  "$invoiceDetails",
                  { $ifNull: ["$items", []] },
                ],
              },
            },
          },
          { $unwind: "$lines" },
          {
            $project: {
              ma: {
                $toUpper: {
                  $trim: {
                    input: {
                      $toString: {
                        $ifNull: [
                          "$lines.productCode",
                          { $ifNull: ["$lines.ma", "$lines.code"] },
                        ],
                      },
                    },
                  },
                },
              },
              qty: {
                $convert: {
                  input: { $ifNull: ["$lines.quantity", { $ifNull: ["$lines.sl", 0] }] },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
              price: {
                $convert: {
                  input: {
                    $ifNull: [
                      "$lines.price",
                      { $ifNull: ["$lines.gia", { $ifNull: ["$lines.giaBan", 0] }] },
                    ],
                  },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
              discount: {
                $convert: {
                  input: { $ifNull: ["$lines.discount", 0] },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
          { $match: { ma: { $nin: ["", "NULL", "UNDEFINED"] } } },
          {
            $group: {
              _id: "$ma",
              revenue: {
                $sum: {
                  $max: [
                    0,
                    {
                      $subtract: [{ $multiply: ["$qty", "$price"] }, "$discount"],
                    },
                  ],
                },
              },
            },
          },
          { $match: { revenue: { $gt: 0 } } },
          { $sort: { revenue: -1 } },
          { $limit: 3000 },
        ];
      };

      const col = db.collection(INVOICES_COL);
      let rows = await col
        .aggregate(pipeline(true), { allowDiskUse: true, maxTimeMS: 25000 })
        .toArray();
      if (!rows.length) {
        rows = await col
          .aggregate(pipeline(false), { allowDiskUse: true, maxTimeMS: 25000 })
          .toArray();
      }
      return {
        items: rows.map((r) => ({
          ma: String((r as { _id?: string })._id || ""),
          revenue: Number((r as { revenue?: number }).revenue) || 0,
        })),
        at: Date.now(),
        days: BESTSELLER_DAYS,
      };
    },
    BESTSELLER_TTL_SEC
  );

  const map = new Map<string, number>();
  const items = (body as { items?: { ma: string; revenue: number }[] })?.items || [];
  for (const it of items) {
    const ma = normalizeMa(it.ma);
    if (ma && it.revenue > 0) map.set(ma, it.revenue);
  }
  return map;
}
