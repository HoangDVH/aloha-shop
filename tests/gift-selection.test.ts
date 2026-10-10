import test from "node:test";
import assert from "node:assert/strict";
import type { ShopProduct } from "../frontend/lib/api";
import { withGiftSelection } from "../frontend/components/catalog/giftProductSelection";
import { emptyScopedFilters, filterScopedProducts } from "../frontend/components/catalog/scopedProductFilters";

const product = (ma: string, ten: string, gia = 250000): ShopProduct => ({ ma, ten, gia, dvt: "Cây", nhom: "", nhomPath: "", ton: 1, anh: "", images: [], isActive: true, path: "", categorySlug: "", productSlug: "" });
test("verified placement and height never leak onto unknown products", () => {
  const input = product("KNBL", "KIM NGÂN BÍNH LỚN");
  const p = withGiftSelection(input);
  assert.ok(p.attributes?.some(a => a.attributeValue === "Đặt sàn / sảnh"));
  assert.equal(p.giftDimensions, undefined);
  assert.equal(input.attributes, undefined);
  const unknown = withGiftSelection(product("unknown", "CÂY CAO LỚN"));
  assert.equal(unknown.attributes?.some(a => a.attributeName === "Vị trí đặt"), false);
  assert.equal(unknown.giftDimensions, undefined);
  assert.equal(withGiftSelection(product("TPBADB", "BÌNH AN ĐỂ BÀN")).giftDimensions, "Cây + chậu cao 25–35 cm");
});
test("species handles uppercase Vietnamese and gift filters combine with budget", () => {
  const products = [withGiftSelection(product("CBKTYT", "KIM TIỀN YÊU THƯƠNG", 230000)), withGiftSelection(product("KNBL", "KIM NGÂN BÍNH LỚN", 1500000))];
  const filters = { ...emptyScopedFilters(), attrs: ["Vị trí đặt:Để bàn", "Loại cây:Kim Tiền"], minPrice: "200000", maxPrice: "500000" };
  assert.deepEqual(filterScopedProducts(products, filters, "ban_chay").map(p => p.ma), ["CBKTYT"]);
  assert.equal(filterScopedProducts(products, { ...filters, maxPrice: "199999" }, "ban_chay").length, 0);
});
test("audited single-species mix pots and mixed landscapes have distinct gift types", () => {
  assert.ok(withGiftSelection(product("BS3MKT", "CHẬU BOM S3 MIX KIM TIỀN")).attributes?.some(a => a.attributeValue === "Chậu cây đơn"));
  assert.ok(withGiftSelection(product("TXTVDL", "COMBO THANH XUÂN THỊNH VƯỢNG ĐẠI LỢI")).attributes?.some(a => a.attributeValue === "Tiểu cảnh phối sẵn"));
});
