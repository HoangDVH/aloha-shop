import test from "node:test";
import assert from "node:assert/strict";
import { normalizePopup, vnDay } from "../backend/shopAppearance/popup.js";
import {
  popupAudienceAllowed,
  popupCapped,
  popupInSchedule,
  popupPathAllowed,
} from "../frontend/lib/popupRules.js";

const DAY = 24 * 60 * 60 * 1000;

test("normalizePopup: cấu hình cũ nhận mặc định chuẩn sàn", () => {
  const p = normalizePopup({ enabled: true, imageUrl: "/a.webp", campaignId: "sale" });
  assert.equal(p.pages, "home");
  assert.equal(p.audience, "all");
  assert.equal(p.reopenBadge, true);
  assert.equal(p.startAt, "");
  assert.equal(p.endAt, "");
  assert.equal(p.everyVisit, false);
  assert.equal(normalizePopup({ everyVisit: true }).everyVisit, true);
  assert.equal(normalizePopup({ everyVisit: "yes" as never }).everyVisit, false);
});

test("normalizePopup: lọc giá trị lạ, bỏ giờ tắt trước giờ bật", () => {
  const p = normalizePopup({
    pages: "checkout" as never,
    audience: "vip" as never,
    startAt: "2026-10-18T00:00:00+07:00",
    endAt: "2026-10-17T00:00:00+07:00",
    reopenBadge: false,
  });
  assert.equal(p.pages, "home");
  assert.equal(p.audience, "all");
  assert.equal(p.startAt, "2026-10-17T17:00:00.000Z");
  assert.equal(p.endAt, "");
  assert.equal(p.reopenBadge, false);
  assert.equal(normalizePopup({ startAt: "not a date" }).startAt, "");
});

test("vnDay theo giờ VN", () => {
  assert.equal(vnDay(Date.parse("2026-10-19T17:30:00Z")), "2026-10-20");
});

test("popupPathAllowed: mặc định chỉ trang chủ, không bao giờ ở luồng mua", () => {
  assert.equal(popupPathAllowed("/"), true);
  assert.equal(popupPathAllowed("/uu-dai"), false);
  assert.equal(popupPathAllowed("/uu-dai", "home_deals"), true);
  assert.equal(popupPathAllowed("/uu-dai/flash", "home_deals"), true);
  assert.equal(popupPathAllowed("/sp/ABC", "home_deals"), false);
  assert.equal(popupPathAllowed("/sp/ABC", "all"), true);
  for (const p of ["/gio-hang", "/xac-nhan-don-hang", "/don-hang/1", "/tai-khoan", "/dang-nhap"]) {
    assert.equal(popupPathAllowed(p, "all"), false, p);
  }
});

test("popupInSchedule: trước giờ bật / từ giờ tắt thì không hiện", () => {
  const p = { startAt: "2026-10-17T00:00:00.000Z", endAt: "2026-10-21T00:00:00.000Z" };
  assert.equal(popupInSchedule(p, Date.parse("2026-10-16T23:59:59Z")), false);
  assert.equal(popupInSchedule(p, Date.parse("2026-10-18T00:00:00Z")), true);
  assert.equal(popupInSchedule(p, Date.parse("2026-10-21T00:00:00Z")), false);
  assert.equal(popupInSchedule({ startAt: "", endAt: "" }, 0), true);
});

test("popupAudienceAllowed: khách chưa đăng nhập tính là khách mới", () => {
  const guest = { loggedIn: false, newBuyer: true };
  const oldBuyer = { loggedIn: true, newBuyer: false };
  assert.equal(popupAudienceAllowed("all", oldBuyer), true);
  assert.equal(popupAudienceAllowed("new", guest), true);
  assert.equal(popupAudienceAllowed("new", null), true);
  assert.equal(popupAudienceAllowed("new", oldBuyer), false);
  assert.equal(popupAudienceAllowed("returning", oldBuyer), true);
  assert.equal(popupAudienceAllowed("returning", guest), false);
  assert.equal(popupAudienceAllowed("returning", null), false);
});

test("popupCapped: đóng rồi thì chờ đủ ngày, đổi ảnh thì hiện lại", () => {
  const now = Date.parse("2026-10-18T00:00:00Z");
  const rec = { at: new Date(now - 2 * DAY).toISOString(), imageUrl: "/a.webp" };
  assert.equal(popupCapped(null, "/a.webp", 7, false, now), false);
  assert.equal(popupCapped(rec, "/a.webp", 7, false, now), true);
  assert.equal(popupCapped(rec, "/a.webp", 1, false, now), false);
  assert.equal(popupCapped(rec, "/a.webp", 1, true, now), true);
  assert.equal(popupCapped(rec, "/b.webp", 7, true, now), false);
});
