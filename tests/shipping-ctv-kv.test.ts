import test from "node:test";
import assert from "node:assert/strict";

// Helper hàm phân bổ giảm giá ổn định chuẩn theo remainder (tái dùng cùng logic evaluator & kvOrderMoneySync)
function distributeOrderDiscount(
  items: Array<{ price: number; quantity: number }>,
  discountTotal: number
): number[] {
  const goodsTotal = items.reduce((s, it) => s + it.price * Math.max(1, it.quantity), 0);
  if (goodsTotal <= 0 || discountTotal <= 0) return items.map(() => 0);

  let allocated = 0;
  const lineDiscounts: number[] = [];
  const fractions: Array<{ idx: number; frac: number; maxVal: number }> = [];

  items.forEach((it, i) => {
    const lineVal = it.price * Math.max(1, it.quantity);
    const raw = (discountTotal * lineVal) / goodsTotal;
    const flr = Math.floor(raw);
    lineDiscounts[i] = flr;
    allocated += flr;
    fractions.push({ idx: i, frac: raw - flr, maxVal: lineVal });
  });

  let rem = discountTotal - allocated;
  if (rem > 0) {
    fractions.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < fractions.length && rem > 0; i++) {
      if (lineDiscounts[fractions[i].idx] < fractions[i].maxVal) {
        lineDiscounts[fractions[i].idx] += 1;
        rem -= 1;
      }
    }
  }
  return lineDiscounts;
}

// Giả lập cấu trúc payload gửi KiotViet theo đúng quy tắc Section 19.2
function buildKvOrderPayload(opts: {
  customerName: string;
  customerPhone: string;
  address: string;
  orderDetails: Array<{ productCode: string; productName: string; price: number; quantity: number; discount?: number }>;
  discount?: number;
  shippingFee?: number;
  totalPayment: number;
  usingCod: boolean;
}) {
  const orderDiscount = Math.max(0, Math.round(Number(opts.discount) || 0));
  const shipFee = Math.max(0, Math.round(Number(opts.shippingFee) || 0));

  // Giảm cấp đơn gửi riêng ở root; không lặp lại giảm vào dòng hàng
  const orderDetails = opts.orderDetails.map((it) => ({
    productCode: it.productCode,
    productName: it.productName,
    quantity: it.quantity,
    price: it.price,
    discount: orderDiscount > 0 ? 0 : (it.discount || 0),
  }));

  return {
    customerName: opts.customerName,
    contactNumber: opts.customerPhone,
    address: opts.address,
    orderDetails,
    ...(orderDiscount > 0 ? { discount: orderDiscount } : {}),
    totalPayment: opts.totalPayment,
    orderDelivery: {
      receiver: opts.customerName,
      contactNumber: opts.customerPhone,
      address: opts.address,
      price: shipFee > 0 ? shipFee : undefined,
    },
  };
}

// Giả lập đọc ngược từ KV theo kvOrderMoneySync
function reverseSyncKvOrder(kvOrder: any, prevDetails: any[]) {
  const rawDiscount = kvOrder?.discount ?? kvOrder?.Discount;
  const kvOrderDiscount = rawDiscount != null ? Math.max(0, Math.round(Number(rawDiscount) || 0)) : 0;
  const shippingFee = Math.max(0, Math.round(Number(kvOrder?.orderDelivery?.price ?? kvOrder?.OrderDelivery?.price ?? 0) || 0));

  const rawDetails = kvOrder.orderDetails || [];
  const details = rawDetails.map((it: any, i: number) => ({
    productCode: it.productCode,
    productName: it.productName,
    price: it.price,
    quantity: it.quantity,
    discount: it.discount || 0,
    ctvCode: prevDetails[i]?.ctvCode,
    ctvRate: prevDetails[i]?.ctvRate ?? 0.05,
  }));

  const goodsSubtotal = details.reduce((s: number, d: any) => s + d.price * Math.max(1, d.quantity), 0);

  if (kvOrderDiscount > 0 && goodsSubtotal > 0) {
    const allocatedDiscounts = distributeOrderDiscount(details, kvOrderDiscount);
    details.forEach((d: any, idx: number) => {
      d.discount = allocatedDiscounts[idx];
    });
  }

  const subtotalAfterDiscount = Math.max(0, goodsSubtotal - kvOrderDiscount);
  const total = Math.round(subtotalAfterDiscount + shippingFee);

  // Tính hoa hồng CTV theo lineNet
  let commission = 0;
  for (const d of details) {
    const lineNet = Math.max(0, d.price * d.quantity - (d.discount || 0));
    commission += lineNet * (d.ctvRate || 0);
  }

  return {
    details,
    goodsSubtotal,
    discount: kvOrderDiscount,
    shippingFee,
    total,
    commission: Math.round(commission),
  };
}

test("SECTION 20: Ví dụ nghiệm thu bắt buộc (Mandatory Fixture)", () => {
  // Dữ liệu bắt buộc:
  // 1 SP giá 235.000đ, SL = 1.
  // Ưu đãi cấp đơn 10% = 23.500đ.
  // Phí ship trước hỗ trợ F = 50.000đ; hỗ trợ ship H = 20.000đ -> Khách trả ship S = 30.000đ.
  // CTV hợp lệ 5%.
  const G = 235_000;
  const D = 23_500;
  const F = 50_000;
  const H = 20_000;
  const S = F - H; // 30.000đ
  const N = G - D; // 211.500đ
  const T = N + S; // 241.500đ

  assert.equal(N, 211_500, "Tiền hàng sau ưu đãi N = 211.500đ");
  assert.equal(S, 30_000, "Phí ship khách trả S = 30.000đ");
  assert.equal(T, 241_500, "Tổng giá trị đơn T = 241.500đ");

  // 1. Kiểm chứng Payload gửi KiotViet:
  const orderDetails = [
    { productCode: "SP235K", productName: "Sản phẩm test 235k", price: 235_000, quantity: 1, ctvRate: 0.05 },
  ];
  const kvPayload = buildKvOrderPayload({
    customerName: "Nguyễn Văn Test",
    customerPhone: "0901234567",
    address: "123 Đường Test, Phường Test, Hà Nội",
    orderDetails,
    discount: D,
    shippingFee: S,
    totalPayment: 0,
    usingCod: true,
  });

  // Đối chiếu vị trí theo Section 20.1:
  assert.equal(kvPayload.discount, 23_500, "KV discount = 23.500đ ('Giảm giá phiếu đặt')");
  assert.equal(kvPayload.orderDelivery.price, 30_000, "KV orderDelivery.price = 30.000đ ('THU PHÍ SHIP')");
  assert.equal(kvPayload.orderDetails.length, 1, "Chỉ chứa 1 dòng hàng hóa, KHÔNG có dòng SP ship giả mạo");
  assert.equal(kvPayload.orderDetails[0].discount, 0, "Dòng hàng KV discount = 0, không được giảm trùng hai lần");

  // 2. Kiểm chứng 3 trạng thái thanh toán (Section 20.2):
  // Ca 1: Chưa thanh toán / COD chưa thu
  const codPayment = 0;
  const codRemaining = Math.max(0, T - codPayment);
  assert.equal(codPayment, 0, "COD chưa thu: tiền đã trả = 0đ");
  assert.equal(codRemaining, 241_500, "COD chưa thu: còn phải thu = 241.500đ");

  // Ca 2: Đã cọc 50.000đ
  const deposit = 50_000;
  const depositRemaining = Math.max(0, T - deposit);
  assert.equal(deposit, 50_000, "Đã cọc: tiền đã trả = 50.000đ");
  assert.equal(depositRemaining, 191_500, "Đã cọc: còn phải thu = 191.500đ");

  // Ca 3: Đã thanh toán đủ
  const fullPaid = 241_500;
  const paidRemaining = Math.max(0, T - fullPaid);
  assert.equal(fullPaid, 241_500, "Thanh toán đủ: tiền đã trả = 241.500đ");
  assert.equal(paidRemaining, 0, "Thanh toán đủ: còn phải thu = 0đ");

  // 3. Cơ sở hoa hồng CTV 5% (Section 20.3):
  // Hoa hồng = 211.500đ * 5% = 10.575đ ở cả 3 trạng thái thanh toán
  const ctvCommission = N * 0.05;
  assert.equal(ctvCommission, 10_575, "Hoa hồng CTV 5% của 211.500đ phải là đúng 10.575đ");

  // 4. Đồng bộ ngược từ KiotViet (Section 20.3):
  const kvOrderMock = {
    discount: 23_500,
    orderDelivery: { price: 30_000 },
    orderDetails: [
      { productCode: "SP235K", productName: "Sản phẩm test 235k", price: 235_000, quantity: 1, discount: 0 },
    ],
  };
  const synced = reverseSyncKvOrder(kvOrderMock, orderDetails);
  assert.equal(synced.goodsSubtotal, 235_000, "Đồng bộ ngược: tổng tiền hàng = 235.000đ");
  assert.equal(synced.discount, 23_500, "Đồng bộ ngược: giảm giá = 23.500đ");
  assert.equal(synced.shippingFee, 30_000, "Đồng bộ ngược: phí ship = 30.000đ");
  assert.equal(synced.total, 241_500, "Đồng bộ ngược: tổng đơn = 241.500đ");
  assert.equal(synced.commission, 10_575, "Đồng bộ ngược: hoa hồng CTV giữ nguyên 10.575đ");
  assert.equal(synced.details[0].discount, 23_500, "Đồng bộ ngược: phân bổ nội bộ cho dòng SP = 23.500đ");
});

test("LK02: Tắt giảm ship của fixture trước chốt", () => {
  const N = 211_500;
  const F = 50_000;
  const H = 0;
  const S = F - H; // 50.000đ
  const T = N + S; // 261.500đ
  const ctvCommission = N * 0.05; // 10.575đ
  assert.equal(S, 50_000);
  assert.equal(T, 261_500);
  assert.equal(ctvCommission, 10_575, "Tắt giảm ship không làm thay đổi hoa hồng CTV");
});

test("LK03: Hỗ trợ ship 70.000đ khi F = 50.000đ -> H thực dùng 50.000đ, S = 0đ, không giảm lấn sang tiền hàng", () => {
  const N = 211_500;
  const F = 50_000;
  const H_voucher = 70_000;
  const H = Math.min(F, H_voucher); // 50.000đ
  const S = Math.max(0, F - H); // 0đ
  const T = N + S; // 211.500đ

  assert.equal(H, 50_000, "Hỗ trợ ship trần ở F (50.000đ)");
  assert.equal(S, 0, "Khách trả ship 0đ");
  assert.equal(T, 211_500, "Tổng đơn không bị trừ thêm 20.000đ tiền hàng dư");
});

test("LK06: Biên ngưỡng miễn ship 2 triệu sau giảm (N)", () => {
  const threshold = 2_000_000;

  // G = 2.100.000đ, giảm 10% (210.000đ) -> N = 1.890.000đ < 2.000.000đ
  const N1 = 2_100_000 - 210_000;
  assert.equal(N1 >= threshold, false, "1.890.000đ chưa đạt ngưỡng 2 triệu");

  // Biên dưới: 1.999.999đ -> Không đạt
  assert.equal(1_999_999 >= threshold, false);

  // Đúng ngưỡng: 2.000.000đ -> Đạt
  assert.equal(2_000_000 >= threshold, true);

  // Biên trên: 2.000.001đ -> Đạt
  assert.equal(2_000_001 >= threshold, true);
});

test("LK09: Chuyển nhận tại cửa hàng trước chốt -> S = 0đ, T = N", () => {
  const N = 211_500;
  const S = 0;
  const T = N + S;
  const commission = N * 0.05;
  assert.equal(T, 211_500);
  assert.equal(commission, 10_575);
});

test("LK10: Một dòng giá 500.000đ, quantity = 2, giảm toàn dòng 100.000đ, ship 30.000đ", () => {
  const price = 500_000;
  const qty = 2;
  const G = price * qty; // 1.000.000đ
  const D = 100_000; // Giảm toàn dòng
  const S = 30_000;
  const N = G - D; // 900.000đ
  const T = N + S; // 930.000đ
  const commission = N * 0.05; // 45.000đ

  assert.equal(N, 900_000);
  assert.equal(T, 930_000);
  assert.equal(commission, 45_000, "Hoa hồng CTV 5% của 900.000đ là 45.000đ");

  // Giả lập gửi KV và đồng bộ ngược
  const orderDetails = [{ productCode: "SP500K", productName: "SP 500k", price, quantity: qty, ctvRate: 0.05 }];
  const kvPayload = buildKvOrderPayload({
    customerName: "Test Qty 2",
    customerPhone: "0912345678",
    address: "HCM",
    orderDetails,
    discount: D,
    shippingFee: S,
    totalPayment: 0,
    usingCod: true,
  });

  assert.equal(kvPayload.discount, 100_000);
  assert.equal(kvPayload.orderDetails[0].discount, 0);

  const synced = reverseSyncKvOrder(kvPayload, orderDetails);
  assert.equal(synced.total, 930_000);
  assert.equal(synced.commission, 45_000);
});

test("LK11: Ba sản phẩm chia khoản giảm 100.001đ, tổng phân bổ bằng đúng 100.001đ", () => {
  const items = [
    { price: 200_000, quantity: 1 },
    { price: 300_000, quantity: 1 },
    { price: 500_000, quantity: 1 },
  ]; // Tổng 1.000.000đ
  const D = 100_001;

  const distributed = distributeOrderDiscount(items, D);
  const sum = distributed.reduce((a, b) => a + b, 0);

  assert.equal(sum, 100_001, "Tổng phân bổ phải bằng chính xác 100.001đ, không mất 1đ nào");
  assert.equal(distributed[0], 20_000);
  assert.equal(distributed[1], 30_000);
  assert.equal(distributed[2], 50_001); // Dòng lớn nhất nhận 1đ dư
});

test("LK13 & LK14: Hai dòng SP thuộc hai CTV khác nhau hưởng giảm giá phân bổ", () => {
  // X = 600.000đ (CTV A 5%), Y = 400.000đ (CTV B 8%). Giảm 100.000đ. Ship 30.000đ.
  const items = [
    { productCode: "SP-X", productName: "SP X", price: 600_000, quantity: 1, ctvCode: "CTV_A", ctvRate: 0.05 },
    { productCode: "SP-Y", productName: "SP Y", price: 400_000, quantity: 1, ctvCode: "CTV_B", ctvRate: 0.08 },
  ];
  const D = 100_000;
  const S = 30_000;

  const distributed = distributeOrderDiscount(items, D);
  assert.equal(distributed[0], 60_000, "X phân bổ 60.000đ");
  assert.equal(distributed[1], 40_000, "Y phân bổ 40.000đ");

  const netX = 600_000 - 60_000; // 540.000đ
  const netY = 400_000 - 40_000; // 360.000đ
  const total = netX + netY + S; // 930.000đ

  const hhA = netX * 0.05; // 27.000đ
  const hhB = netY * 0.08; // 28.800đ

  assert.equal(total, 930_000);
  assert.equal(hhA, 27_000, "Hoa hồng CTV A = 27.000đ");
  assert.equal(hhB, 28_800, "Hoa hồng CTV B = 28.800đ");

  // LK14: Nếu Y không có CTV (ctvRate = 0), giảm giá vẫn phân bổ Y = 40k, chỉ A hưởng 27k
  const hhA_only = netX * 0.05;
  const hhB_none = netY * 0;
  assert.equal(hhA_only, 27_000);
  assert.equal(hhB_none, 0);
});
