import test from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { parseQuickOrder } from "../backend/shopOrders/quickOrder/quickOrderParser.js";
import { createQuickOrder } from "../backend/shopOrders/quickOrder/quickOrderService.js";
import { publicPrice } from "../backend/shopCatalog/priceOverlay.js";

test("quickOrderParser regex fallback parses phone and recipient info", async () => {
  const fakeDb = {
    collection: () => ({
      findOne: async () => null,
      find: () => ({
        project: () => ({
          limit: () => ({
            toArray: async () => [],
          }),
        }),
      }),
    }),
  } as unknown as Db;

  const rawText = "Gửi chị Huỳnh Như - 0909123456, giao về 45 Đường số 7, P. Linh Trung, TP. Thủ Đức, HCM giùm shop.";
  const res = await parseQuickOrder(fakeDb, { text: rawText });

  assert.equal(res.customer.phone, "0909123456");
  assert.ok(res.customer.name.includes("Huỳnh Như"));
  assert.ok(res.customer.address.includes("Đường số 7"));
});

test("publicPrice resolves giaWeb as default priority over basePrice and giaBan", () => {
  // Test case 1: SP có cả giaWeb, giaBan, basePrice -> phải lấy giaWeb
  const docWithWeb = {
    ma: "SP01",
    ten: "Chậu đá mài chữ nhật",
    giaWeb: 180000,
    giaBan: 200000,
    basePrice: 220000,
  };
  assert.equal(publicPrice(docWithWeb), 180000);

  // Test case 2: SP có bảng giá web embedded
  const docWithPriceBook = {
    ma: "SP02",
    ten: "Chậu xi măng tròn",
    priceBooks: [
      { name: "Bảng giá chung", price: 150000 },
      { name: "Giá Web", price: 135000 },
    ],
    basePrice: 160000,
  };
  assert.equal(publicPrice(docWithPriceBook), 135000);
});

test("createQuickOrder validates recipient name and phone", async () => {
  const fakeDb = {} as Db;

  await assert.rejects(
    async () => {
      await createQuickOrder(fakeDb, fakeDb, {
        customerName: "",
        customerPhone: "0909123456",
        address: "123 Lê Lợi",
        province: "HCM",
        district: "Q1",
        ward: "Bến Nghé",
        items: [{ productCode: "SP01", productName: "Chậu", quantity: 1, price: 100000 }],
        paymentMethod: "Cash",
      });
    },
    { message: /tên khách hàng/ }
  );

  await assert.rejects(
    async () => {
      await createQuickOrder(fakeDb, fakeDb, {
        customerName: "Nguyễn Văn A",
        customerPhone: "12345", // Sai format
        address: "123 Lê Lợi",
        province: "HCM",
        district: "Q1",
        ward: "Bến Nghé",
        items: [{ productCode: "SP01", productName: "Chậu", quantity: 1, price: 100000 }],
        paymentMethod: "Cash",
      });
    },
    { message: /Số điện thoại không hợp lệ/ }
  );
});

test("parseQuickOrder returns matched items with web price even when query is from image analysis", async () => {
  const fakeDb = {
    collection: () => ({
      findOne: async () => null,
      find: () => ({
        project: () => ({
          limit: () => ({
            toArray: async () => [
              {
                ma: "CBCTPT",
                ten: "THÀNH PHẨM CẦN THĂNG PHÁT TÀI (CẦN THĂNG GỐC THỤ)",
                giaWeb: 934000,
                giaBan: 730000,
                basePrice: 730000,
                images: ["https://cdn.kiotviet.vn/sample.jpg"],
              },
            ],
          }),
        }),
      }),
    }),
  } as unknown as Db;

  const res = await parseQuickOrder(fakeDb, {
    text: "lấy chậu thành phẩm cần thăng phát tài",
  });

  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].productCode, "CBCTPT");
  assert.equal(res.items[0].price, 934000); // Giá Web 934.000đ thay vì Giá Bán 730.000đ
});
