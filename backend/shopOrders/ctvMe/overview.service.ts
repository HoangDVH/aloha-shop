/**
 * Business logic for CTV Me Overview metrics & lists.
 */
import type { GetDb } from "../../auth/middleware.js";
import { normalizeCtvCode } from "../../shopAuth/models.js";
import { SHOP_COMMISSIONS } from "../commissionModels.js";
import type { ActiveCtvContext } from "./shared.js";

export async function getCtvOverview(
  getDb: GetDb,
  activeCtv: ActiveCtvContext,
  query: { from?: unknown; to?: unknown }
) {
  const now = new Date();
  let from = new Date(String(query.from || ""));
  let to = new Date(String(query.to || ""));
  if (!Number.isFinite(from.getTime())) {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!Number.isFinite(to.getTime())) {
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  if (to < from) {
    const t = from;
    from = to;
    to = t;
  }
  // Chuẩn hóa cuối ngày cho `to` dạng date-only
  if (String(query.to || "").length <= 10) {
    to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  }
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const clicksCol = activeCtv.shopDb.collection("aloha_shop_ctv_clicks");
  const ordersCol = activeCtv.shopDb.collection("aloha_shop_orders");
  const commCol = activeCtv.shopDb.collection(SHOP_COMMISSIONS);

  const [clicksCount, clickDocs, orders, commissions] = await Promise.all([
    clicksCol.countDocuments({
      ctv: activeCtv.ctvCode,
      $or: [
        { createdAt: { $gte: from, $lte: to } },
        { createdAtIso: { $gte: fromIso, $lte: toIso } },
      ],
    }),
    clicksCol
      .find({
        ctv: activeCtv.ctvCode,
        $or: [
          { createdAt: { $gte: from, $lte: to } },
          { createdAtIso: { $gte: fromIso, $lte: toIso } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(80)
      .project({ ma: 1, path: 1, createdAt: 1, createdAtIso: 1 })
      .toArray(),
    ordersCol
      .find({
        ctvCodes: activeCtv.ctvCode,
        $or: [
          { createdAt: { $gte: fromIso, $lte: toIso } },
          { createdAt: { $gte: from, $lte: to } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(120)
      .project({
        code: 1,
        customerPhone: 1,
        customerName: 1,
        total: 1,
        totalPayment: 1,
        orderStatus: 1,
        paymentStatus: 1,
        method: 1,
        usingCod: 1,
        createdAt: 1,
        orderDetails: 1,
      })
      .toArray(),
    commCol
      .find({
        ctvCode: activeCtv.ctvCode,
        status: { $nin: ["cancelled"] },
        $or: [
          { createdAt: { $gte: fromIso, $lte: toIso } },
          { createdAt: { $gte: from, $lte: to } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(80)
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
      if (normalizeCtvCode(String(d?.ctvCode || "")) !== activeCtv.ctvCode) continue;
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
  for (const c of clickDocs) {
    const ma = String((c as any).ma || "")
      .trim()
      .toUpperCase();
    if (ma) needMas.add(ma);
  }

  const byMa = new Map<
    string,
    { anh: string; giaWeb: number; ten: string }
  >();
  if (needMas.size) {
    const mas = [...needMas];
    const mainDb = await getDb();
    const products = await mainDb
      .collection("aloha_products")
      .find({
        deletedAt: null,
        $or: [
          { ma: { $in: mas } },
          { ma: { $in: mas.map((m) => m.toLowerCase()) } },
        ],
      })
      .project({
        ma: 1,
        ten: 1,
        anh: 1,
        images: 1,
        giaWeb: 1,
        giaBan: 1,
        giaChung: 1,
      })
      .toArray();
    for (const p of products) {
      const ma = String((p as any).ma || "")
        .trim()
        .toUpperCase();
      if (!ma) continue;
      const anh =
        String((p as any).anh || "").trim() ||
        String(
          (Array.isArray((p as any).images) && (p as any).images[0]) || ""
        ).trim();
      const giaWeb =
        Number((p as any).giaWeb) ||
        Number((p as any).giaBan) ||
        Number((p as any).giaChung) ||
        0;
      byMa.set(ma, {
        anh,
        giaWeb,
        ten: String((p as any).ten || "").trim(),
      });
    }
  }

  const enrichItem = (d: any) => {
    const ma = String(d?.productCode || d?.ma || "")
      .trim()
      .toUpperCase();
    const cat = ma ? byMa.get(ma) : undefined;
    const qty = Math.max(1, Math.floor(Number(d?.quantity ?? d?.qty) || 1));
    const price =
      Math.max(0, Number(d?.price ?? d?.gia) || 0) || (cat?.giaWeb ?? 0);
    const giaWeb = cat?.giaWeb || price;
    return {
      ma,
      ten: String(d?.productName || d?.ten || "").trim() || cat?.ten || ma,
      qty,
      price,
      giaWeb,
      imageUrl:
        String(d?.imageUrl || "").trim() || cat?.anh || undefined,
    };
  };

  let gmv = 0;
  let qtySold = 0;
  const phones = new Set<string>();
  const orderList: Array<{
    code: string;
    orderStatus: string;
    orderLabel: string;
    payLabel: string;
    total: number;
    createdAt: string | null;
    items: ReturnType<typeof enrichItem>[];
  }> = [];
  const productLines: Array<{
    id: string;
    orderCode: string;
    ma: string;
    productName: string;
    imageUrl?: string;
    giaWeb: number;
    qty: number;
    lineTotal: number;
    orderLabel: string;
  }> = [];
  const buyerMap = new Map<
    string,
    {
      phone: string;
      phoneMasked: string;
      name: string;
      orderCount: number;
      total: number;
      items: ReturnType<typeof enrichItem>[];
    }
  >();

  for (const o of activeOrders) {
    const total = Number((o as any).total ?? (o as any).totalPayment) || 0;
    gmv += total;
    const phone = String((o as any).customerPhone || "").replace(/\D/g, "");
    if (phone.length >= 9) phones.add(phone);
    const st = String((o as any).orderStatus || "").toLowerCase();
    const pay = String((o as any).paymentStatus || "").toLowerCase();
    const isCod =
      Boolean((o as any).usingCod) ||
      pay === "cod" ||
      String((o as any).method) === "Cash";
    let payLabel = "Chờ thanh toán";
    if (pay === "paid" || pay === "da_thanh_toan") payLabel = "Đã thanh toán";
    else if (isCod) payLabel = "COD — thu khi giao";
    else if (pay === "pending" || pay === "cho_ck" || st === "cho_thanh_toan")
      payLabel = "Chờ chuyển khoản";
    let orderLabel = "Đang xử lý";
    if (st === "hoan_thanh") orderLabel = "Hoàn thành";
    else if (st === "dang_giao") orderLabel = "Đang giao";
    else if (st === "cho_xu_ly" || st === "cho") orderLabel = "Chờ xử lý";
    else if (st === "cho_thanh_toan") orderLabel = "Chờ thanh toán";
    else if (st === "thieu_hang") orderLabel = "Thiếu hàng";

    const details = Array.isArray((o as any).orderDetails)
      ? (o as any).orderDetails
      : [];
    const myLines = details
      .filter(
        (d: any) =>
          normalizeCtvCode(String(d?.ctvCode || "")) === activeCtv.ctvCode
      )
      .map(enrichItem);
    // Nếu dòng không gắn ctvCode từng SP, vẫn hiện toàn bộ SP trong đơn CTV
    const items =
      myLines.length > 0
        ? myLines
        : details.map(enrichItem).filter((it: any) => it.ma);

    for (const it of items) {
      qtySold += it.qty;
      productLines.push({
        id: `${(o as any).code}-${it.ma}-${productLines.length}`,
        orderCode: String((o as any).code || ""),
        ma: it.ma,
        productName: it.ten,
        imageUrl: it.imageUrl,
        giaWeb: it.giaWeb,
        qty: it.qty,
        lineTotal: it.price * it.qty,
        orderLabel,
      });
    }

    orderList.push({
      code: String((o as any).code || ""),
      orderStatus: st,
      orderLabel,
      payLabel,
      total,
      createdAt: (o as any).createdAt
        ? String((o as any).createdAt)
        : null,
    items,
    });

    if (phone.length >= 9) {
      const prev = buyerMap.get(phone);
      const masked =
        phone.length >= 10
          ? `${phone.slice(0, 3)}***${phone.slice(-3)}`
          : `${phone.slice(0, 2)}***`;
      if (!prev) {
        buyerMap.set(phone, {
          phone,
          phoneMasked: masked,
          name: String((o as any).customerName || "").trim() || "Khách",
          orderCount: 1,
          total,
          items: [...items],
        });
      } else {
        prev.orderCount += 1;
        prev.total += total;
        prev.items.push(...items);
      }
    }
  }

  let estimatedCommission = 0;
  const commissionLines = commissions.map((c: any, idx: number) => {
    const amount = Number(c.amount) || 0;
    estimatedCommission += amount;
    const ma = String(c.ma || "")
      .trim()
      .toUpperCase();
    const cat = ma ? byMa.get(ma) : undefined;
    const qty = Math.max(1, Math.floor(Number(c.qty) || 1));
    const giaWeb =
      Number(c.unitPrice) ||
      (Number(c.lineTotal) > 0
        ? Math.round(Number(c.lineTotal) / qty)
        : 0) ||
      (cat?.giaWeb ?? 0);
    return {
      id: String(c._id || `${c.orderCode}-${ma}-${idx}`),
      orderCode: String(c.orderCode || ""),
      ma,
      productName:
        String(c.productName || "").trim() || cat?.ten || ma || "Sản phẩm",
      imageUrl: String(c.imageUrl || "").trim() || cat?.anh || undefined,
      giaWeb,
      qty,
      amount,
      status: String(c.status || ""),
      rate: c.rate != null ? Number(c.rate) : undefined,
    };
  });

  const clickLines = clickDocs.map((c: any, idx: number) => {
    const ma = String(c.ma || "")
      .trim()
      .toUpperCase();
    const cat = ma ? byMa.get(ma) : undefined;
    return {
      id: String(c._id || `click-${idx}`),
      ma: ma || "",
      productName: cat?.ten || ma || String(c.path || "Click CTV"),
      imageUrl: cat?.anh || undefined,
      giaWeb: cat?.giaWeb || 0,
      path: String(c.path || ""),
      createdAt: c.createdAtIso || c.createdAt || null,
    };
  });

  return {
    ok: true,
    from: fromIso.slice(0, 10),
    to: toIso.slice(0, 10),
    metrics: {
      clicks: clicksCount,
      orders: activeOrders.length,
      qtySold,
      gmv,
      estimatedCommission,
      buyers: phones.size,
    },
    lists: {
      orders: orderList,
      lines: productLines,
      commissions: commissionLines,
      clicks: clickLines,
      buyers: [...buyerMap.values()].map((b) => ({
        phoneMasked: b.phoneMasked,
        name: b.name,
        orderCount: b.orderCount,
        total: b.total,
        items: b.items,
      })),
    },
  };
}
