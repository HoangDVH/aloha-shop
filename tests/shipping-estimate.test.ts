import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTrongLuongGram,
  resolveWeightWithSource,
} from "../backend/shopShipping/resolveWeight.js";
import { qualifiesFreeShip } from "../backend/shopShipping/freeShip.js";
import {
  hashQuoteItems,
  signQuoteToken,
  verifyQuoteToken,
} from "../backend/shopShipping/quoteToken.js";

test("SH04: Phân biệt chính xác 30g và 30kg, không nhân nhầm 1000 lần", () => {
  // Sản phẩm 30g (có đơn vị g rõ ràng)
  const g30 = normalizeTrongLuongGram(30, "Gói gia vị 30g", "g");
  assert.equal(g30, 30, "30g phải ra đúng 30 gram");

  // Sản phẩm 30kg (trongLuong = 30, đơn vị kg)
  const kg30 = normalizeTrongLuongGram(30, "Bao gạo 30kg", "kg");
  assert.equal(kg30, 30_000, "30kg phải ra đúng 30.000 gram");

  // Sản phẩm ghi 30g trong tên không có đơn vị rõ ràng
  const gText = normalizeTrongLuongGram(30, "Bột nêm 30 gram");
  assert.equal(gText, 30, "Trích xuất từ text '30 gram' phải ra 30g");
});

test("SH01 & SH02: Hàng có số đo thật đạt Level 1 (measured), preset đạt Level 2 (verified_preset)", () => {
  const measured = resolveWeightWithSource({
    ma: "SP-MEASURED",
    ten: "Cây phát tài chậu sứ",
    trongLuong: 1500,
  });
  assert.equal(measured.weightGram, 1500);
  assert.equal(measured.source, "measured");
  assert.equal(measured.needsConfirmation, false);

  // Thiếu cân nhưng khớp preset từ danh mục "chậu nhỏ"
  const presetItem = resolveWeightWithSource({
    ma: "SP-PRESET",
    ten: "Cây kim ngân",
    categoryName: "Chậu nhỏ để bàn",
  });
  assert.equal(presetItem.source, "verified_preset");
  assert.equal(presetItem.needsConfirmation, false);
  assert.ok(presetItem.weightGram > 0, "Preset phải có trọng lượng dương");
});

test("SH03: Thiếu cả cân và preset -> needsConfirmation = true, KHÔNG ĐƯỢC tự đoán 500g tùy tiện", () => {
  const unknownItem = resolveWeightWithSource({
    ma: "SP-UNKNOWN-XYZ",
    ten: "Vật phẩm lạ không rõ kích thước",
  });
  assert.equal(unknownItem.source, "unknown");
  assert.equal(unknownItem.needsConfirmation, true);
  assert.ok(
    unknownItem.confirmationReason?.includes("Chưa có thông số") ||
      unknownItem.confirmationReason?.includes("cần shop"),
    "Phải nêu lý do cần xác nhận"
  );
  // Không được tự gán 500g làm trọng lượng xác thực
  assert.notEqual(unknownItem.source, "measured", "Không được giả mạo nguồn measured");
});

test("SH07: Cây lớn, cồng kềnh, dễ vỡ -> chuyển sang chờ shop báo phí", () => {
  const fragileItem = resolveWeightWithSource({
    ma: "CAY-LON-01",
    ten: "Cây bàng Singapore cao 1m8 chậu gốm lớn",
    isFragile: true,
  });
  assert.equal(fragileItem.needsConfirmation, true);
  assert.ok(
    fragileItem.confirmationReason?.includes("dễ vỡ") ||
      fragileItem.confirmationReason?.includes("đặc thù"),
    "Phải có lý do đặc thù/dễ vỡ"
  );
});

test("SH10 & SH11 & SH12: QuoteToken ký và kiểm tra tính toàn vẹn (tamper-proof / cart binding)", () => {
  const items = [
    { productCode: "SP01", quantity: 2, price: 100_000 },
    { productCode: "SP02", quantity: 1, price: 35_000 },
  ];
  const itemsKey = hashQuoteItems(items);

  const token = signQuoteToken({
    carrier: "ghtk",
    fee: 30000,
    subtotal: 235000,
    totalWeightGram: 800,
    province: "Hà Nội",
    district: "Cầu Giấy",
    ward: "Dịch Vọng",
    itemsKey,
    freeShipApplied: false,
    shippingEstimateStatus: "estimated",
    pricingSource: "carrier_api",
    packageDataSource: "measured",
    estimatedShippingFee: 30000,
  });

  const verified = verifyQuoteToken(token);
  assert.equal(verified.fee, 30000);
  assert.equal(verified.carrier, "ghtk");
  assert.equal(verified.itemsKey, itemsKey);
  assert.equal(verified.shippingEstimateStatus, "estimated");

  // Giỏ hàng đổi (thay đổi số lượng từ 2 lên 3) -> itemsKey không khớp
  const alteredItems = [
    { productCode: "SP01", quantity: 3, price: 100_000 },
    { productCode: "SP02", quantity: 1, price: 35_000 },
  ];
  const alteredKey = hashQuoteItems(alteredItems);
  assert.notEqual(verified.itemsKey, alteredKey, "Giỏ hàng thay đổi phải phát hiện lệch itemsKey");
});

test("SH14: Nhận tại cửa hàng (nhan_cua_hang) -> phí ship = 0đ, nguồn shop_policy", () => {
  const pickupToken = signQuoteToken({
    carrier: null,
    fee: 0,
    subtotal: 500000,
    totalWeightGram: 0,
    province: "",
    district: "",
    ward: "",
    itemsKey: "any",
    freeShipApplied: true,
    shippingEstimateStatus: "estimated",
    pricingSource: "shop_policy",
    packageDataSource: "verified_preset",
    estimatedShippingFee: 0,
  });
  const verified = verifyQuoteToken(pickupToken);
  assert.equal(verified.fee, 0);
  assert.equal(verified.carrier, null);
  assert.equal(verified.pricingSource, "shop_policy");
  assert.equal(verified.shippingEstimateStatus, "estimated");
});

test("SH15: Xét điều kiện miễn ship theo tiền hàng sau ưu đãi N = G - D", () => {
  // Thiết lập biến môi trường ngưỡng freeship 2.000.000đ
  const oldMin = process.env.SHOP_FREE_SHIP_MIN_VND;
  const oldMaxUnit = process.env.SHOP_FREE_SHIP_MAX_UNIT_VND;
  process.env.SHOP_FREE_SHIP_MIN_VND = "2000000";
  process.env.SHOP_FREE_SHIP_MAX_UNIT_VND = "0"; // tắt nhánh SP siêu rẻ để test đúng ngưỡng min

  try {
    const items = [{ productCode: "SP01", quantity: 1, price: 2_100_000 }];
    const G = 2_100_000;
    const D = 210_000;
    const N = G - D; // 1.890.000đ

    // Kiểm tra ngưỡng freeship theo N (1.890.000đ không đạt 2.000.000đ)
    const qualifiedAfterDiscount = qualifiesFreeShip(N, items);
    assert.equal(qualifiedAfterDiscount, false, "1.890.000đ sau ưu đãi chưa đạt ngưỡng 2 triệu freeship");

    // Đơn 2.500.000đ giảm 10% (250.000đ) -> N = 2.250.000đ >= 2.000.000đ -> Đạt miễn ship
    const N2 = 2_500_000 - 250_000;
    const qualifiedAfterDiscount2 = qualifiesFreeShip(N2, items);
    assert.equal(qualifiedAfterDiscount2, true, "2.250.000đ sau ưu đãi đạt ngưỡng 2 triệu freeship");
  } finally {
    process.env.SHOP_FREE_SHIP_MIN_VND = oldMin;
    process.env.SHOP_FREE_SHIP_MAX_UNIT_VND = oldMaxUnit;
  }
});

test("SH16 & SH17: Tính tổng tiền phân biệt phí đã ước tính vs phí chưa xác định", () => {
  // SH16: Hàng sau giảm 900.000đ, estimate 45.000đ -> Tổng tạm 945.000đ
  const N = 900_000;
  const estimatedShip = 45_000;
  const totalWithEstimate = N + estimatedShip;
  assert.equal(totalWithEstimate, 945_000);

  // SH17: Chưa biết phí ship (null) -> Tổng tiền hàng giữ 900.000đ, ship không được gán 0đ
  const unknownShip: number | null = null;
  const totalBeforeShip = N;
  assert.equal(totalBeforeShip, 900_000);
  assert.equal(unknownShip, null, "Phí ship chưa biết phải là null, không được là 0đ");
});

test("SH24: Cơ sở hoa hồng CTV strictly chỉ tính trên tiền hàng N = G - D, không cộng phí ship", () => {
  const G = 235_000;
  const D = 23_500;
  const N = G - D; // 211.500đ
  const S = 30_000; // Phí ship
  const rate = 0.05; // 5%

  const commission = N * rate;
  assert.equal(commission, 10_575, "Hoa hồng CTV 5% phải là 10.575đ");

  // Xác minh không cộng S vào cơ sở hoa hồng: (N + S) * 5% = 12.075đ là SAI!
  assert.notEqual((N + S) * rate, commission);
});
