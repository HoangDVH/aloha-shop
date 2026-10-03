import test from "node:test";
import assert from "node:assert/strict";
import {
  isInvalidCampaign,
  isSafeHref,
  isSafeImageUrl,
  validateCampaignContent,
} from "../backend/shopCampaigns/schema.js";
import { daiLeContent } from "./helpers/campaignFixtures.js";

const fieldsOf = (input: unknown) => {
  const v = validateCampaignContent(input);
  return isInvalidCampaign(v) ? v.fields.map((f) => f.path) : [];
};

test("CP01 (schema): bản nháp theo fixture hợp lệ", () => {
  const v = validateCampaignContent(daiLeContent());
  assert.equal(v.ok, true);
});

test("CP02: thiếu endAt / slot start > end / quota âm / màu sai / link javascript: → lỗi theo từng trường", () => {
  const c: any = daiLeContent();
  delete c.info.endAt;
  c.slots[0] = { key: "S09", start: "12:00", end: "09:00" };
  c.products[0].quota = -1;
  c.display.colors.primary = "red";
  c.display.announcement.href = "javascript:alert(1)";
  const paths = fieldsOf(c);
  for (const p of ["info.endAt", "slots.0.end", "products.0.quota", "display.colors.primary", "display.announcement.href"]) {
    assert.ok(paths.includes(p), `thiếu lỗi cho ${p}: ${paths.join(", ")}`);
  }
});

test("CP02: ngày kết thúc trước ngày bắt đầu bị chặn", () => {
  const c = daiLeContent({ endAt: "2026-09-30T00:00:00.000Z" });
  assert.ok(fieldsOf(c).includes("info.endAt"));
});

test("CP02: sản phẩm dùng khung giờ không tồn tại / lặp trong cùng khung", () => {
  const c = daiLeContent();
  c.products.push({ ma: "SP_X", salePrice: 1000, quota: 1, perCustomerLimit: 1, slotKey: "S99" });
  c.products.push({ ma: "SP_A", salePrice: 120_000, quota: 5, perCustomerLimit: 2 });
  const paths = fieldsOf(c);
  assert.ok(paths.includes("products.3.slotKey"));
  assert.ok(paths.includes("products.4.ma"));
});

test("Quà: bản nháp cũ `gift` (1 quà) được chuyển thành `gifts`, không còn trường cũ", () => {
  const v = validateCampaignContent(daiLeContent());
  assert.equal(v.ok, true);
  if (!v.ok) return;
  const sp = v.value.products[2] as any;
  assert.deepEqual(sp.gifts, [{ ma: "QUA_G", qty: 1, quota: 3 }]);
  assert.equal("gift" in sp, false);
});

test("Quà: nhiều quà hợp lệ; trùng mã quà / quá 5 quà bị chặn đúng dòng", () => {
  const c: any = daiLeContent();
  c.products[2] = { ...c.products[2], gift: undefined, gifts: [{ ma: "qua_g", qty: 1, quota: 3 }, { ma: "BD", qty: 2, quota: 5 }] };
  assert.equal(validateCampaignContent(c).ok, true);
  c.products[2].gifts.push({ ma: "QUA_G", qty: 1, quota: 1 });
  assert.ok(fieldsOf(c).includes("products.2.gifts.2.ma"));
  c.products[2].gifts = ["A", "B", "C", "D", "E", "F"].map((ma) => ({ ma, qty: 1, quota: 1 }));
  assert.ok(fieldsOf(c).includes("products.2.gifts"));
});

test("EX02 (schema): khung 22:00–01:00 hợp lệ khi bật qua nửa đêm", () => {
  const c = daiLeContent();
  c.slots.push({ key: "S22", start: "22:00", end: "01:00", overnight: true });
  assert.equal(validateCampaignContent(c).ok, true);
  c.slots[3].overnight = false;
  assert.ok(fieldsOf(c).includes("slots.3.end"));
});

test("SEC01: chữ có <script> / onerror= được giữ như chữ thường (hiển thị escape), không làm hỏng lưu", () => {
  const c = daiLeContent();
  c.display.hero.title = "<script>alert(1)</script> **nổi bật**";
  c.display.announcement.text = "<img src=x onerror=alert(1)>";
  const v = validateCampaignContent(c);
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.value.display.hero.title, "<script>alert(1)</script> **nổi bật**");
});

test("SEC02: href javascript: / data: / //domain lạ bị chặn; nội bộ và https được phép", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "//evil.com/x", "http://evil.com", "/\\evil.com"]) {
    assert.equal(isSafeHref(bad), false, bad);
  }
  for (const ok of ["/uu-dai", "/sp/V1T?x=1", "https://aloha.vn/a", ""]) assert.equal(isSafeHref(ok), true, ok);
  assert.equal(isSafeImageUrl("https://cdn.x/a.svg"), false);
  assert.equal(isSafeImageUrl("/uploads/a.webp"), true);
});

test("SEC02: banner dùng link lạ bị chặn khi lưu", () => {
  const c = daiLeContent();
  c.display.banners[0].href = "https://ok.vn";
  c.display.banners[0].imageUrl = "data:image/png;base64,xx";
  assert.ok(fieldsOf(c).includes("display.banners.0.imageUrl"));
});
