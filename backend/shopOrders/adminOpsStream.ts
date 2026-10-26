/**
 * Seller Center — SSE ops admin + badge counts.
 */
import type { Express, Response } from "express";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../auth/middleware.js";
import { syncBus, type SyncChangePayload } from "../syncBus.js";
import { SHOP_ORDERS } from "./models.js";
import { SHOP_ACCOUNTS } from "../shopAuth/models.js";
import { SHOP_CTV_FRAUD_EVENTS } from "./commissionModels.js";
import { APPLICATIONS_COL } from "../shopRecruitment/types.js";
import type { GetShopDb } from "./routes.js";

const OPS_COLS = new Set([
  "shop_orders",
  "aloha_shop_accounts",
  "aloha_shop_ctv_fraud_events",
  "aloha_shop_ctv_fraud",
  "shop_payment_alerts",
  "aloha_shop_payment_alerts",
  "aloha_shop_commissions",
  "recruitment_applications",
]);

export function registerShopAdminOpsRoutes(
  app: Express,
  getDb: GetDb,
  getShopDb: GetShopDb
) {
  const gate = [requireAuth(getDb), requireActive, requireManager];

  app.get(
    "/api/shop/admin/ops/counts",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const [ordersNeedAction, ctvPending, fraudOpen] = await Promise.all([
          shopDb.collection(SHOP_ORDERS).countDocuments({
            $or: [
              { paymentStatus: { $in: ["unpaid", "processing", "reported"] } },
              {
                orderStatus: {
                  $in: ["cho_xu_ly", "cho_thanh_toan", "cho"],
                },
              },
            ],
            orderStatus: { $nin: ["huy"] },
          }),
          shopDb.collection(SHOP_ACCOUNTS).countDocuments({
            ctvStatus: "cho_duyet",
            roles: "ctv",
          }),
          shopDb.collection(SHOP_CTV_FRAUD_EVENTS).countDocuments({
            $or: [{ reviewStatus: "open" }, { reviewStatus: { $exists: false } }],
          }),
        ]);
        return res.json({
          ok: true,
          ordersNeedAction,
          ctvPending,
          fraudOpen,
          at: Date.now(),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "counts_failed" });
      }
    }
  );

  app.get(
    "/api/shop/admin/ops/notifications",
    ...gate,
    async (_req: AuthRequest, res: Response) => {
      try {
        const shopDb = await getShopDb();
        const [
          recentOrders,
          wholesaleAccounts,
          ctvAccounts,
          applications,
          ordersNeedAction,
          siPending,
          ctvPending,
          recruitmentNew,
        ] = await Promise.all([
          shopDb
            .collection(SHOP_ORDERS)
            .find({}, { projection: { code: 1, kvOrderCode: 1, kvInvoiceCode: 1, orderStatus: 1, paymentStatus: 1, shippingAddress: 1, customerName: 1, customerPhone: 1, grandTotal: 1, total: 1, priceMode: 1, createdAt: 1 } })
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray(),
          shopDb
            .collection(SHOP_ACCOUNTS)
            .find(
              { $or: [{ roles: "si" }, { siStatus: { $exists: true, $ne: null } }] },
              { projection: { fullName: 1, phone: 1, email: 1, roles: 1, siStatus: 1, siRegion: 1, siVerificationStatus: 1, createdAt: 1 } }
            )
            .sort({ createdAt: -1 })
            .limit(15)
            .toArray(),
          shopDb
            .collection(SHOP_ACCOUNTS)
            .find(
              { $or: [{ roles: "ctv" }, { ctvStatus: { $exists: true, $ne: null } }] },
              { projection: { fullName: 1, phone: 1, email: 1, roles: 1, ctvStatus: 1, ctvCode: 1, createdAt: 1 } }
            )
            .sort({ createdAt: -1 })
            .limit(15)
            .toArray(),
          shopDb
            .collection(APPLICATIONS_COL)
            .find(
              {},
              { projection: { publicCode: 1, contact: 1, fullName: 1, phone: 1, interestedPosition: 1, "jobSummary.title": 1, status: 1, createdAt: 1 } }
            )
            .sort({ createdAt: -1 })
            .limit(15)
            .toArray(),
          shopDb.collection(SHOP_ORDERS).countDocuments({
            $or: [
              { paymentStatus: { $in: ["unpaid", "processing", "reported"] } },
              {
                orderStatus: {
                  $in: ["cho_xu_ly", "cho_thanh_toan", "cho"],
                },
              },
            ],
            orderStatus: { $nin: ["huy"] },
          }),
          shopDb.collection(SHOP_ACCOUNTS).countDocuments({
            roles: "si",
            siStatus: "cho_duyet",
          }),
          shopDb.collection(SHOP_ACCOUNTS).countDocuments({
            roles: "ctv",
            ctvStatus: "cho_duyet",
          }),
          shopDb.collection(APPLICATIONS_COL).countDocuments({
            status: { $in: ["new", "reviewing"] },
          }),
        ]);

        const orderItems = recentOrders.map((o: any) => {
          const isSi = o.priceMode === "si";
          const totalVal = typeof o.grandTotal === "number" ? o.grandTotal : (typeof o.total === "number" ? o.total : 0);
          const totalStr = totalVal > 0 ? totalVal.toLocaleString("vi-VN") + "đ" : "";
          const name = o.shippingAddress?.fullName || o.customerName || "Khách mua lẻ";
          const phone = o.shippingAddress?.phone || o.customerPhone || "";
          let stt = "Đơn mới";
          if (o.orderStatus === "cho_xu_ly") stt = "Chờ xử lý";
          else if (o.orderStatus === "cho_thanh_toan") stt = "Chờ thanh toán";
          else if (o.orderStatus === "cho_xac_nhan") stt = "Chờ xác nhận";
          else if (o.orderStatus === "hoan_thanh") stt = "Hoàn thành";
          else if (o.orderStatus === "huy") stt = "Đã hủy";

          const targetCode = o.code || o.kvOrderCode || o._id;
          const displayCode = o.kvOrderCode || o.code || o._id;

          return {
            id: `order_${o.code || o._id}`,
            type: "order" as const,
            title: `Đơn hàng mới #${displayCode}`,
            subtitle: [name, phone, totalStr].filter(Boolean).join(" • "),
            detail: stt,
            createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
            link: `/admin/don-hang-web?code=${encodeURIComponent(targetCode)}`,
            tag: isSi ? "Đơn sỉ" : "Đơn web",
            tagColor: isSi ? "purple" : "emerald",
            needsAction: ["cho_xu_ly", "cho_thanh_toan", "cho_xac_nhan", "cho"].includes(o.orderStatus) && o.orderStatus !== "huy",
          };
        });

        const wholesaleItems = wholesaleAccounts.map((a: any) => {
          const isPending = a.siStatus === "cho_duyet" || a.siVerificationStatus === "pending";
          const name = a.fullName || a.phone || "Khách sỉ";
          const region = a.siRegion === "HCM" ? "TP.HCM" : a.siRegion === "TINH" ? "Tỉnh" : "Chưa chọn vùng";
          return {
            id: `si_${a._id}`,
            type: "wholesale" as const,
            title: `Đăng ký Khách sỉ: ${name}`,
            subtitle: `SĐT: ${a.phone || "Chưa có"} • Email: ${a.email || "Chưa có"}`,
            detail: `Khu vực: ${region} • ${isPending ? "Chờ duyệt sỉ" : "Đã kích hoạt"}`,
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
            link: `/admin/ctv/khach-hang?id=${encodeURIComponent(String(a._id))}&q=${encodeURIComponent(a.phone || a.fullName || "")}`,
            tag: isPending ? "Chờ duyệt" : "Khách sỉ",
            tagColor: isPending ? "amber" : "purple",
            needsAction: isPending,
          };
        });

        const ctvItems = ctvAccounts.map((a: any) => {
          const isPending = a.ctvStatus === "cho_duyet";
          const name = a.fullName || a.phone || "Cộng tác viên";
          const link = a.ctvCode
            ? `/admin/ctv/danh-sach/${encodeURIComponent(a.ctvCode)}`
            : `/admin/ctv/khach-hang?id=${encodeURIComponent(String(a._id))}&q=${encodeURIComponent(a.phone || "")}`;
          return {
            id: `ctv_${a._id}`,
            type: "ctv" as const,
            title: `Đăng ký CTV: ${name}`,
            subtitle: `SĐT: ${a.phone || "Chưa có"} • Mã: ${a.ctvCode || "Mới"}`,
            detail: isPending ? "Hồ sơ CTV đang chờ duyệt" : "CTV đang hoạt động",
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
            link,
            tag: isPending ? "Chờ duyệt" : "CTV",
            tagColor: isPending ? "amber" : "blue",
            needsAction: isPending,
          };
        });

        const recruitmentItems = applications.map((app: any) => {
          const isNew = app.status === "new" || app.status === "reviewing";
          const name = app.contact?.fullName || app.fullName || "Ứng viên";
          const phone = app.contact?.phone || app.phone || "";
          const job = app.jobSummary?.title || app.interestedPosition || "Ứng tuyển vị trí";
          return {
            id: `recruitment_${app._id}`,
            type: "recruitment" as const,
            title: `Người nộp đơn tuyển dụng: ${name}`,
            subtitle: `Vị trí: ${job} • SĐT: ${phone}`,
            detail: `Trạng thái: ${app.status === "new" ? "Hồ sơ mới" : app.status === "reviewing" ? "Đang xem xét" : app.status || "Chờ xử lý"}`,
            createdAt: app.createdAt ? new Date(app.createdAt).toISOString() : new Date().toISOString(),
            link: `/admin/tuyen-dung/ho-so?id=${encodeURIComponent(String(app._id))}&code=${encodeURIComponent(app.publicCode || "")}`,
            tag: isNew ? "Ứng viên mới" : "Tuyển dụng",
            tagColor: isNew ? "cyan" : "slate",
            needsAction: isNew,
          };
        });

        const allItems = [...orderItems, ...wholesaleItems, ...ctvItems, ...recruitmentItems]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 40);

        return res.json({
          ok: true,
          items: allItems,
          counts: {
            total: ordersNeedAction + siPending + ctvPending + recruitmentNew,
            orders: ordersNeedAction,
            wholesale: siPending,
            ctv: ctvPending,
            recruitment: recruitmentNew,
          },
          at: Date.now(),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "notifications_failed" });
      }
    }
  );

  app.get(
    "/api/shop/admin/ops/stream",
    ...gate,
    async (req: AuthRequest, res: Response) => {
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

      const onChange = (payload: SyncChangePayload) => {
        const cols = payload?.collections || [];
        const hit = cols.some((c) => OPS_COLS.has(c) || c.includes("fraud") || c.includes("order") || c.includes("account") || c.includes("commission") || c.includes("payment") || c.includes("recruitment"));
        if (!hit) return;
        writeEvent("ops", {
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
    }
  );
}
