import test from "node:test";
import assert from "node:assert/strict";
import { isFinishedPlantCategory, isWholesaleHomeViewer, orderWholesaleHomeProducts, wholesaleHomeHref } from "../frontend/lib/homeWholesaleOrder.js";

const product = (ma: string, nhomPath: string) => ({ ma, nhomPath });
const pots = Array.from({ length: 5 }, (_, i) => product(`P${i}`, "CHẬU TRỒNG CÂY >> CHẬU BÁT TRÀNG"));
const plants = Array.from({ length: 3 }, (_, i) => product(`C${i}`, "CÂY CẢNH ĐỦ LOẠI >> CÂY PHONG THỦY"));
const finished = [product("F", "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM TRỒNG SẴN >> CÂY TRỒNG THỦY SINH"), product("S", "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM SALE >> ĐỒNG GIÁ")];

test("active wholesale viewers see wholesale home before and after regional verification", () => {
  for (const siRegion of ["HCM", "TINH", null]) assert.equal(isWholesaleHomeViewer({ roles: ["si"], siStatus: "active", siRegion }), true);
  for (const user of [null, { roles: ["ctv"] }, { roles: ["si"], siStatus: "cho_duyet", siRegion: "HCM" },
    { roles: ["si"], siStatus: "khoa", siRegion: "TINH" }, { roles: ["si"], siStatus: "active", active: false, siRegion: null },
    { roles: ["khach"], siStatus: "active", siRegion: "HCM" }]) assert.equal(isWholesaleHomeViewer(user), false);
});

test("two pots alternate with an ordinary plant; finished products stay last", () => {
  const input = [...finished, ...plants, product("O", "ĐĨA LÓT CHẬU"), ...pots];
  const snapshot = input.slice();
  const out = orderWholesaleHomeProducts(input);
  assert.deepEqual(out.map(p => p.ma), ["P0", "P1", "C0", "P2", "P3", "C1", "P4", "C2", "O", "F", "S"]);
  assert.deepEqual(input, snapshot);
  assert.equal(new Set(out.map(p => p.ma)).size, input.length);
});

test("insufficient pots/plants fills from remaining groups without dropping products", () => {
  assert.deepEqual(orderWholesaleHomeProducts([...finished, ...plants]).map(p => p.ma), ["C0", "C1", "C2", "F", "S"]);
  assert.deepEqual(orderWholesaleHomeProducts([...finished, ...pots]).map(p => p.ma), ["P0", "P1", "P2", "P3", "P4", "F", "S"]);
  assert.deepEqual(orderWholesaleHomeProducts([]), []);
});

test("classification uses category ancestry rather than the word pot in a plant name", () => {
  assert.equal(isFinishedPlantCategory("cay-thanh-pham-trong-san"), true);
  assert.equal(isFinishedPlantCategory("CÂY THÀNH PHẨM SALE >> 170K"), true);
  assert.equal(isFinishedPlantCategory("CÂY PHONG THỦY"), false);
  const misleading = { ...plants[0], ten: "Cây trong chậu trồng cây" };
  assert.deepEqual(orderWholesaleHomeProducts([misleading, ...pots]).slice(0, 3).map(p => p.ma), ["P0", "P1", "C0"]);
});

test("pots lead other groups with stock then revenue priority inside each group", () => {
  const items = [
    { ...pots[0], ton: 2 }, { ...pots[1], ton: 40 },
    { ...plants[0], ton: 80 }, { ...finished[0], ton: 100 }, { ...plants[1], ton: 40 },
  ];
  const rank = new Map([["C1", 900], ["P1", 100]]);
  assert.deepEqual(orderWholesaleHomeProducts(items, true, rank).map(p => p.ma), ["P1", "P0", "C0", "C1", "F"]);
});

test("high-stock stickers and accessories cannot displace pots on wholesale home", () => {
  const items = [{ ma: "STICKER", ton: 99999, nhomPath: "PHỤ KIỆN TRANG TRÍ" },
    { ma: "BOARD", ton: 9000, nhomPath: "PHỤ KIỆN TRANG TRÍ" },
    { ...pots[0], ton: 12 }, { ...pots[1], ton: 90 }, { ...pots[2], ton: 90 }];
  const rank = new Map([["P2", 100], ["P1", 50]]);
  assert.deepEqual(orderWholesaleHomeProducts(items, true, rank).map(p => p.ma), ["P2", "P1", "P0", "STICKER", "BOARD"]);
});

test("view-more preserves private list only for wholesale featured/offer links", () => {
  assert.equal(wholesaleHomeHref("/tim?badge=noi_bat", true), "/tim?badge=noi_bat&homeOrder=wholesale");
  assert.equal(wholesaleHomeHref("/tim?badge=uu_dai&page=2", true), "/tim?badge=uu_dai&page=2&homeOrder=wholesale");
  assert.equal(wholesaleHomeHref("/tim?badge=uu_dai", false), "/tim?badge=uu_dai");
  assert.equal(wholesaleHomeHref("/tim?sort=moi", true), "/tim?sort=moi");
});
