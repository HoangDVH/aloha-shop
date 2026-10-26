import test from "node:test";
import assert from "node:assert/strict";

type PrintableOrder = {
  code: string;
  kvOrderCode?: string | null;
  kvInvoiceCode?: string | null;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    detail?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  kvDeliveryAddress?: {
    state?: string;
    reason?: string;
    original?: { province: string; district?: string; ward: string };
    current?: { province: string; ward: string };
  };
  total: number;
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  voucherDiscount?: number;
  paymentStatus: string;
  orderDetails?: Array<{
    productCode?: string;
    productName?: string;
    quantity?: number;
    price?: number;
    discount?: number;
    variantLabel?: string;
    isGift?: boolean;
  }>;
};

function resolveFullAddress(order: PrintableOrder): string {
  if (order.customerAddress) return order.customerAddress;
  const sa = order.shippingAddress;
  if (sa) {
    return [sa.detail, sa.ward, sa.district, sa.province].filter(Boolean).join(", ");
  }
  const kv = order.kvDeliveryAddress;
  if (kv?.current) {
    return `${kv.current.ward}, ${kv.current.province}`;
  }
  return "Nhận tại cửa hàng ALOHA";
}

function computeCodAmount(order: PrintableOrder): number {
  return order.paymentStatus === "paid" ? 0 : order.total;
}

function generateZaloMessage(order: PrintableOrder, fullAddress: string): string {
  const items = (order.orderDetails && order.orderDetails.length > 0)
    ? order.orderDetails.map(it => `• ${it.productName || "Sản phẩm"}${it.variantLabel ? ` (${it.variantLabel})` : ""}: SL ${it.quantity || 1}`)
    : [`• Đơn hàng web tổng hợp: SL 1`];

  return [
    `🌿 ALOHA THẾ GIỚI CHẬU CÂY`,
    `Xác nhận đơn hàng: #${order.kvOrderCode || order.code}`,
    `Khách hàng: ${order.customerName || "Quý khách"}`,
    `SĐT: ${order.customerPhone || "—"}`,
    `Địa chỉ: ${fullAddress}`,
    `--------------------------`,
    ...items,
    `--------------------------`,
    `Tổng tiền: ${order.total.toLocaleString("vi-VN")}đ`,
    `Thanh toán: ${order.paymentStatus === "paid" ? "Đã thanh toán" : "Thu hộ COD khi nhận"}`,
    `Cảm ơn Quý khách đã tin tưởng ALOHA!`,
  ].join("\n");
}

test("Order Print: Full address resolution prioritizes customerAddress, shippingAddress then kvDeliveryAddress", () => {
  const o1: PrintableOrder = {
    code: "WEB-01",
    createdAt: new Date().toISOString(),
    total: 350000,
    paymentStatus: "unpaid",
    customerAddress: "123 Lê Lợi, P. Bến Nghé, Quận 1, TP. HCM",
  };
  assert.equal(resolveFullAddress(o1), "123 Lê Lợi, P. Bến Nghé, Quận 1, TP. HCM");

  const o2: PrintableOrder = {
    code: "WEB-02",
    createdAt: new Date().toISOString(),
    total: 350000,
    paymentStatus: "unpaid",
    shippingAddress: {
      detail: "Số 45",
      ward: "Phường Thảo Điền",
      district: "TP Thủ Đức",
      province: "TP. Hồ Chí Minh",
    },
  };
  assert.equal(resolveFullAddress(o2), "Số 45, Phường Thảo Điền, TP Thủ Đức, TP. Hồ Chí Minh");

  const o3: PrintableOrder = {
    code: "WEB-03",
    createdAt: new Date().toISOString(),
    total: 350000,
    paymentStatus: "unpaid",
    kvDeliveryAddress: {
      current: { ward: "Phường 1", province: "TP. Đà Lạt" },
    },
  };
  assert.equal(resolveFullAddress(o3), "Phường 1, TP. Đà Lạt");

  const o4: PrintableOrder = {
    code: "WEB-04",
    createdAt: new Date().toISOString(),
    total: 350000,
    paymentStatus: "unpaid",
  };
  assert.equal(resolveFullAddress(o4), "Nhận tại cửa hàng ALOHA");
});

test("Order Print: COD amount is 0 when paid, and equals total when unpaid/cod", () => {
  const paidOrder: PrintableOrder = {
    code: "WEB-PAID",
    createdAt: new Date().toISOString(),
    total: 500000,
    paymentStatus: "paid",
  };
  assert.equal(computeCodAmount(paidOrder), 0);

  const unpaidOrder: PrintableOrder = {
    code: "WEB-UNPAID",
    createdAt: new Date().toISOString(),
    total: 500000,
    paymentStatus: "unpaid",
  };
  assert.equal(computeCodAmount(unpaidOrder), 500000);
});

test("Order Print: Zalo message formatted cleanly with items and totals", () => {
  const order: PrintableOrder = {
    code: "WEB-999",
    kvOrderCode: "DH100999",
    createdAt: new Date().toISOString(),
    customerName: "Nguyễn Văn A",
    customerPhone: "0901234567",
    total: 250000,
    paymentStatus: "cod",
    orderDetails: [
      { productName: "Chậu composite tròn", variantLabel: "Trắng 30cm", quantity: 2, price: 125000 },
    ],
  };
  const msg = generateZaloMessage(order, "123 Đường 3/2, Q.10, HCM");
  assert.ok(msg.includes("ALOHA THẾ GIỚI CHẬU CÂY"));
  assert.ok(msg.includes("#DH100999"));
  assert.ok(msg.includes("Nguyễn Văn A"));
  assert.ok(msg.includes("0901234567"));
  assert.ok(msg.includes("Chậu composite tròn (Trắng 30cm): SL 2"));
  assert.ok(msg.includes("Thu hộ COD khi nhận"));
});

test("Order Details KiotViet: Maps line items with unit price, discount, and line total matching KiotViet table", () => {
  const sampleItems = [
    { productCode: "60k", productName: "COMBO TRỒNG CÂY", quantity: 1, price: 69000, discount: 0 },
    { productCode: "LVLL", productName: "LƯỢNG VÀNG SIZE LỚN", quantity: 2, price: 9000, discount: 0 },
    { productCode: "OVCDXN", productName: "CHẬU OVAN", quantity: 1, price: 108000, discount: 8000 },
  ];

  const mapped = sampleItems.map(it => {
    const sellPrice = Math.max(0, it.price - (it.discount || 0));
    return {
      productCode: it.productCode,
      productName: it.productName,
      quantity: it.quantity,
      price: it.price,
      discount: it.discount || 0,
      sellPrice,
      lineTotal: sellPrice * it.quantity,
    };
  });

  assert.equal(mapped[0].lineTotal, 69000);
  assert.equal(mapped[1].lineTotal, 18000);
  assert.equal(mapped[2].sellPrice, 100000);
  assert.equal(mapped[2].lineTotal, 100000);

  const subtotal = mapped.reduce((sum, it) => sum + it.lineTotal, 0);
  assert.equal(subtotal, 187000);
});
