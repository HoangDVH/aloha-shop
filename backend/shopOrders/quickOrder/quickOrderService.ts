import type { Db } from "mongodb";
import { newShopOrderCode, SHOP_ORDERS, type ShopOrderDetail } from "../models.js";
import { pushShopOrderToKiotViet } from "../kvPush.js";
import { publicPrice } from "../../shopCatalog/priceOverlay.js";
import { publicTon } from "../../shopCatalog/catalog/publicProduct.js";
import type {
  QuickOrderCreateInput,
  QuickOrderCreateResult,
  QuickOrderItem,
} from "./quickOrderTypes.js";

const PROD_COL = "aloha_products";

/**
 * Tìm kiếm nhanh sản phẩm từ kho cho thanh gợi ý tự động (autocomplete)
 */
export async function searchQuickOrderProducts(
  db: Db,
  query: string,
  limit = 20
): Promise<QuickOrderItem[]> {
  const q = String(query || "").trim();
  if (!q) return [];

  const col = db.collection(PROD_COL);
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const docs = await col
    .find({
      $or: [{ ma: regex }, { maHang: regex }, { ten: regex }, { name: regex }],
      deletedAt: null,
    })
    .project({
      ma: 1,
      maHang: 1,
      ten: 1,
      name: 1,
      giaWeb: 1,
      giaBan: 1,
      giaChung: 1,
      basePrice: 1,
      priceBooks: 1,
      tonKho: 1,
      onHand: 1,
      kvTon: 1,
      images: 1,
    })
    .limit(limit)
    .toArray();

  return docs.map((d: any) => ({
    productCode: String(d.ma || d.maHang || ""),
    productName: String(d.ten || d.name || ""),
    quantity: 1,
    price: publicPrice(d), // Mặc định GIÁ WEB
    originalPrice: Number(d.basePrice || d.giaChung || d.giaBan || 0),
    stock: publicTon(d),
    imageUrl: Array.isArray(d.images) && d.images[0] ? d.images[0] : "",
  }));
}

/**
 * Tạo đơn hàng từ Quick Order và đẩy trực tiếp lên KiotViet
 */
export async function createQuickOrder(
  shopDb: Db,
  mainDb: Db,
  input: QuickOrderCreateInput,
  creatorUser?: any
): Promise<QuickOrderCreateResult> {
  const customerName = String(input.customerName || "").trim();
  const customerPhone = String(input.customerPhone || "").trim();

  if (!customerName) {
    throw new Error("Vui lòng nhập tên khách hàng");
  }
  if (!customerPhone || !/^(?:\+84|0)\d{9,10}$/.test(customerPhone)) {
    throw new Error("Số điện thoại không hợp lệ (cần 10 số)");
  }
  if (!Array.isArray(input.items) || !input.items.length) {
    throw new Error("Đơn hàng phải có ít nhất 1 sản phẩm");
  }

  // Chuẩn bị danh sách chi tiết đơn hàng
  const orderDetails: ShopOrderDetail[] = input.items.map((it) => {
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
    const prc = Math.max(0, Math.round(Number(it.price) || 0));
    return {
      productCode: String(it.productCode || "").trim(),
      productName: String(it.productName || "").trim(),
      quantity: qty,
      price: prc,
      discount: Math.max(0, Math.round(Number(it.discount) || 0)),
      note: String(it.note || "").trim(),
      priceKind: "web",
    };
  });

  const subtotal = orderDetails.reduce((s, it) => s + it.price * it.quantity, 0);
  const shippingFee = Math.max(0, Math.round(Number(input.shippingFee) || 0));
  const discount = Math.max(0, Math.round(Number(input.discount) || 0));
  const grandTotal = Math.max(0, subtotal + shippingFee - discount);

  const code = newShopOrderCode();
  const method = input.paymentMethod === "Transfer" ? "Transfer" : "Cash";
  const usingCod = method === "Cash";

  const orderDoc: Record<string, unknown> = {
    code,
    source: "admin_quick_order",
    orderStatus: "cho_xac_nhan",
    paymentStatus: "chua_thanh_toan",
    paymentMethod: method,
    usingCod,
    customerName,
    customerPhone,
    shippingAddress: input.address,
    province: input.province,
    district: input.district,
    ward: input.ward,
    ghnDistrictId: input.ghnDistrictId,
    ghnWardCode: input.ghnWardCode,
    orderDetails,
    subtotal,
    shippingFee,
    discount,
    grandTotal,
    total: grandTotal,
    customerNote: String(input.note || "").trim(),
    priceMode: "retail",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: creatorUser?.username || creatorUser?.name || "admin_quick_order",
  };

  // 1. Lưu đơn vào MongoDB của shop
  const insertRes = await shopDb.collection(SHOP_ORDERS).insertOne(orderDoc);
  const orderId = insertRes.insertedId.toString();

  // 2. Đẩy sang KiotViet
  let kvOrderCode: string | undefined;
  let kvOrderId: number | string | undefined;

  try {
    const kvRes = await pushShopOrderToKiotViet(mainDb, {
      customerName,
      customerPhone,
      address: input.address,
      deliveryAddress: {
        province: input.province,
        district: input.district,
        ward: input.ward,
        streetAddress: input.address,
      },
      orderDetails,
      usingCod,
      method,
      description: `Đơn Aloha nhanh ${code}${input.note ? ` - ${input.note}` : ""}`,
      totalPayment: 0,
      shippingFee,
      discount,
    });

    if (kvRes?.kvOrderCode) {
      kvOrderCode = kvRes.kvOrderCode;
      kvOrderId = kvRes.kvOrderId;

      await shopDb.collection(SHOP_ORDERS).updateOne(
        { _id: insertRes.insertedId },
        {
          $set: {
            kvOrderCode,
            kvOrderId,
            kvPushStatus: "pushed",
            kvPushedAt: new Date(),
          },
        }
      );
    }
  } catch (err: any) {
    console.error("[QuickOrder] KiotViet push error:", err?.message || err);
    await shopDb.collection(SHOP_ORDERS).updateOne(
      { _id: insertRes.insertedId },
      {
        $set: {
          kvPushStatus: "failed",
          kvPushError: String(err?.message || err).slice(0, 500),
        },
      }
    );
  }

  return {
    ok: true,
    orderId,
    orderCode: code,
    kvOrderCode,
    kvOrderId,
    total: grandTotal,
    shippingFee,
    discount,
  };
}
