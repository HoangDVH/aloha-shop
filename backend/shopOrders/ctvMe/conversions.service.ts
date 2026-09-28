/**
 * Service for CTV Me Conversions report & calculations.
 */
import type { GetDb } from "../../auth/middleware.js";
import { getCtvSettings, SHOP_COMMISSIONS } from "../commissionModels.js";
import { summarizeCtvCommissionStatus, type ActiveCtvContext } from "./shared.js";

export async function getCtvConversions(
  getDb: GetDb,
  activeCtv: ActiveCtvContext,
  query: {
    from?: unknown;
    to?: unknown;
    orderCode?: unknown;
    q?: unknown;
    orderStatus?: unknown;
    paymentStatus?: unknown;
  }
) {
  const settings = await getCtvSettings(activeCtv.shopDb);
  const now = new Date();
  let from = new Date(String(query.from || ""));
  let to = new Date(String(query.to || ""));
  if (!Number.isFinite(from.getTime())) {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!Number.isFinite(to.getTime())) {
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  if (String(query.to || "").length <= 10) {
    to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  }
  if (to < from) {
    const t = from;
    from = to;
    to = t;
  }
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const orderQ = String(query.orderCode || query.q || "")
    .trim()
    .toUpperCase();
  const statusFilter = String(query.orderStatus || "")
    .trim()
    .toLowerCase();
  const payFilter = String(query.paymentStatus || "")
    .trim()
    .toLowerCase();

  const orders = await activeCtv.shopDb
    .collection("aloha_shop_orders")
    .find({
      ctvCodes: activeCtv.ctvCode,
      $or: [
        { createdAt: { $gte: fromIso, $lte: toIso } },
        { createdAt: { $gte: from, $lte: to } },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .project({
      code: 1,
      kvInvoiceCode: 1,
      kvOrderCode: 1,
      legacyCodes: 1,
      customerPhone: 1,
      customerName: 1,
      total: 1,
      totalPayment: 1,
      orderStatus: 1,
      paymentStatus: 1,
      method: 1,
      usingCod: 1,
      createdAt: 1,
      deliveredAt: 1,
      completedAt: 1,
      orderDetails: 1,
    })
    .toArray();

  const codes = orders
    .map((o) => String((o as any).code || "").trim())
    .filter(Boolean);
  const productMas = new Set<string>();
  for (const o of orders) {
    const details = Array.isArray((o as any).orderDetails)
      ? (o as any).orderDetails
      : [];
    for (const d of details) {
      const ma = String(d?.productCode || d?.ma || "")
        .trim()
        .toUpperCase();
      if (ma) productMas.add(ma);
    }
  }
  const [comms, clicks, productDocs] = await Promise.all([
    codes.length
      ? activeCtv.shopDb
          .collection(SHOP_COMMISSIONS)
          .find({
            ctvCode: activeCtv.ctvCode,
            orderCode: { $in: codes },
          })
          .project({
            orderCode: 1,
            amount: 1,
            ma: 1,
            productName: 1,
            qty: 1,
            status: 1,
            createdAt: 1,
            billingPeriod: 1,
            paidAt: 1,
            eligibleAt: 1,
          })
          .toArray()
      : Promise.resolve([]),
    activeCtv.shopDb
      .collection("aloha_shop_ctv_clicks")
      .find({
        ctv: activeCtv.ctvCode,
        $or: [
          { createdAt: { $gte: from, $lte: to } },
          { createdAtIso: { $gte: fromIso, $lte: toIso } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(300)
      .project({ ma: 1, createdAt: 1, createdAtIso: 1 })
      .toArray(),
    productMas.size
      ? (async () => {
          const mas = [...productMas];
          const mainDb = await getDb();
          return mainDb
            .collection("aloha_products")
            .find({
              deletedAt: null,
              $or: [
                { ma: { $in: mas } },
                { ma: { $in: mas.map((m) => m.toLowerCase()) } },
              ],
            })
            .project({ ma: 1, ten: 1, anh: 1, images: 1 })
            .toArray();
        })()
      : Promise.resolve([]),
  ]);

  const commByOrder = new Map<string, typeof comms>();
  for (const c of comms) {
    const code = String((c as any).orderCode || "").trim();
    if (!code) continue;
    const arr = commByOrder.get(code) || [];
    arr.push(c);
    commByOrder.set(code, arr);
  }

  // Click gần nhất theo mã SP (ước lượng)
  const clickByMa = new Map<string, string>();
  for (const c of clicks) {
    const ma = String((c as any).ma || "")
      .trim()
      .toUpperCase();
    if (!ma || clickByMa.has(ma)) continue;
    const at = (c as any).createdAtIso || (c as any).createdAt;
    if (at) clickByMa.set(ma, String(at));
  }

  const productByMa = new Map<string, { ten: string; anh: string }>();
  for (const p of productDocs) {
    const ma = String((p as any).ma || "")
      .trim()
      .toUpperCase();
    if (!ma) continue;
    const anh =
      String((p as any).anh || "").trim() ||
      String(
        (Array.isArray((p as any).images) && (p as any).images[0]) || ""
      ).trim();
    productByMa.set(ma, {
      ten: String((p as any).ten || "").trim(),
      anh,
    });
  }

  // Đếm số đơn theo SĐT để phân loại khách mới / đã tồn tại
  const phoneCounts = new Map<string, number>();
  for (const o of orders) {
    const phone = String((o as any).customerPhone || "").replace(/\D/g, "");
    if (phone.length >= 9) {
      phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const o of orders) {
    const code = String((o as any).code || "").trim();
    const kvInvoiceCode = String((o as any).kvInvoiceCode || "").trim();
    const kvOrderCode = String((o as any).kvOrderCode || "").trim();
    /** Ưu tiên mã HĐ KV (CK), rồi ĐH KV (COD), rồi mã shop WEB-/DH- */
    const displayCode = kvInvoiceCode || kvOrderCode || code;
    const legacy = Array.isArray((o as any).legacyCodes)
      ? (o as any).legacyCodes.map((x: unknown) => String(x || "").toUpperCase())
      : [];
    if (
      orderQ &&
      !displayCode.toUpperCase().includes(orderQ) &&
      !code.toUpperCase().includes(orderQ) &&
      !kvInvoiceCode.toUpperCase().includes(orderQ) &&
      !kvOrderCode.toUpperCase().includes(orderQ) &&
      !legacy.some((x: string) => x.includes(orderQ))
    ) {
      continue;
    }
    const stRaw = String((o as any).orderStatus || "").toLowerCase();
    const st =
      stRaw === "cho" || stRaw === "cho_xu_ly"
        ? "cho_xu_ly"
        : stRaw;
    if (st === "huy" && statusFilter !== "huy") continue;
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "cho_xu_ly") {
        if (st !== "cho_xu_ly") continue;
      } else if (st !== statusFilter) continue;
    }
    const pay = String((o as any).paymentStatus || "").toLowerCase();
    const isCod =
      Boolean((o as any).usingCod) ||
      pay === "cod" ||
      String((o as any).method) === "Cash";
    const isPaid = pay === "paid" || pay === "da_thanh_toan";
    const isUnpaid =
      !isPaid &&
      !isCod &&
      (pay === "unpaid" ||
        pay === "pending" ||
        pay === "processing" ||
        pay === "cho_ck" ||
        pay === "" ||
        st === "cho_thanh_toan");
    if (payFilter === "paid" && !isPaid) continue;
    if (payFilter === "cod" && !isCod) continue;
    if (payFilter === "pending" && !isUnpaid) continue;
    if (payFilter === "underpaid" && pay !== "underpaid") continue;

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
    else if (st === "huy") orderLabel = "Đã hủy";

    const phone = String((o as any).customerPhone || "").replace(/\D/g, "");
    const buyerStatus =
      phone.length >= 9 && (phoneCounts.get(phone) || 0) > 1
        ? "Đã tồn tại"
        : "Khách mới";

    const orderComms = commByOrder.get(code) || [];
    const totalCommission = orderComms
      .filter((c) => String((c as any).status || "") !== "cancelled")
      .reduce((s, c) => s + (Number((c as any).amount) || 0), 0);
    const hhUx = summarizeCtvCommissionStatus(orderComms, {
      holdDays: settings.returnHoldDays,
    });
    const details = Array.isArray((o as any).orderDetails)
      ? (o as any).orderDetails
      : [];
    const firstMa = String(
      details[0]?.productCode || details[0]?.ma || orderComms[0]?.ma || ""
    )
      .trim()
      .toUpperCase();
    const purchasedAt = (o as any).createdAt
      ? String((o as any).createdAt)
      : null;
    const completedAt = (o as any).deliveredAt || (o as any).completedAt || null;
    const clickAt = firstMa ? clickByMa.get(firstMa) || null : null;

    const productItems: Array<{
      ma: string;
      name: string;
      imageUrl: string;
    }> = [];
    const seenMa = new Set<string>();
    for (const d of details) {
      const ma = String(d.productCode || d.ma || "")
        .trim()
        .toUpperCase();
      if (!ma || seenMa.has(ma)) continue;
      seenMa.add(ma);
      const cat = productByMa.get(ma);
      const name =
        String(d.productName || d.ten || "").trim() ||
        cat?.ten ||
        ma;
      const imageUrl =
        String(d.imageUrl || d.anh || "").trim() || cat?.anh || "";
      productItems.push({ ma, name, imageUrl });
      if (productItems.length >= 3) break;
    }
    if (!productItems.length) {
      for (const c of orderComms) {
        const ma = String((c as any).ma || "")
          .trim()
          .toUpperCase();
        if (!ma || seenMa.has(ma)) continue;
        seenMa.add(ma);
        const cat = productByMa.get(ma);
        productItems.push({
          ma,
          name:
            String((c as any).productName || "").trim() || cat?.ten || ma,
          imageUrl: cat?.anh || "",
        });
        if (productItems.length >= 3) break;
      }
    }
    const productNames = productItems.map((p) => p.name);

    rows.push({
      orderCode: displayCode,
      shopOrderCode: code,
      kvInvoiceCode: kvInvoiceCode || null,
      kvOrderCode: kvOrderCode || null,
      purchasedAt,
      clickAt,
      completedAt: completedAt ? String(completedAt) : null,
      orderStatus: st,
      orderLabel,
      payLabel,
      paymentStatus: pay,
      total: Number((o as any).total ?? (o as any).totalPayment) || 0,
      itemCommission: totalCommission,
      totalCommission,
      buyerStatus,
      products: productItems,
      productSummary: productNames.join(", ") || "—",
      commissionStatus: hhUx.label,
      commissionStatusKey: hhUx.key,
      commissionStatusHint: hhUx.hint,
    });
  }

  return {
    ok: true,
    from: fromIso.slice(0, 10),
    to: toIso.slice(0, 10),
    total: rows.length,
    data: rows,
  };
}
