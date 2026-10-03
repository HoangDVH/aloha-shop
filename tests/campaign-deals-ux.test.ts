import test from "node:test";
import assert from "node:assert/strict";
import { getPhase } from "../backend/shopCampaigns/campaignPhase.js";
import { buildCampaignPromo, type GiftDetails } from "../backend/shopCampaigns/campaignPromo.js";
import { topSellers } from "../backend/shopCampaigns/routes/bestSellers.routes.js";
import type { CampaignProduct } from "../backend/shopCampaigns/types.js";
import { daiLeContent, vn } from "./helpers/campaignFixtures.js";

const LIVE = vn("2026-10-01T10:00");
const withGiftRow = (row: Partial<CampaignProduct>) => {
  const c = daiLeContent();
  c.products.push({ ma: "SP_G", salePrice: 0, quota: 0, perCustomerLimit: 2, gifts: [{ ma: "QUA1", qty: 1, quota: 10 }], ...row });
  return { id: "DAI_LE", content: c, phase: getPhase(c.info, LIVE), publishedAt: null };
};
const SP_G = { ma: "SP_G", gia: 250_000, webPrice: 250_000 };

test("Quà trên card: có ảnh, giá trị và suất còn lại khi server biết", () => {
  const details: GiftDetails = new Map([["QUA1", { name: "Túi giấy", image: "/q.jpg", value: 17_000 }]]);
  const left = new Map([["SP_G:QUA1", 4]]);
  const p = buildCampaignPromo(withGiftRow({}), SP_G, LIVE, details, undefined, left);
  assert.deepEqual(p?.gifts, [{ ma: "QUA1", name: "Túi giấy", qty: 1, image: "/q.jpg", value: 17_000, left: 4 }]);
});

test("Quà: bản cũ chỉ có tên vẫn chạy, không bịa ảnh / giá trị / suất; suất âm về 0", () => {
  const p = buildCampaignPromo(withGiftRow({}), SP_G, LIVE, new Map([["QUA1", "Túi giấy"]]));
  assert.deepEqual(p?.gifts, [{ ma: "QUA1", name: "Túi giấy", qty: 1 }]);
  const over = buildCampaignPromo(withGiftRow({}), SP_G, LIVE, new Map(), undefined, new Map([["SP_G:QUA1", -2]]));
  assert.deepEqual(over?.gifts, [{ ma: "QUA1", name: "QUA1", qty: 1, left: 0 }]);
});

test("Bán chạy: bỏ SP bán dưới ngưỡng, xếp theo số bán, hoà thì theo thứ tự chiến dịch, tối đa 3", () => {
  const sold = new Map([["A", 2], ["B", 9], ["C", 5], ["D", 5], ["E", 7]]);
  assert.deepEqual(topSellers(["A", "B", "C", "D", "E"], sold), [
    { ma: "B", sold: 9 },
    { ma: "E", sold: 7 },
    { ma: "C", sold: 5 },
  ]);
  assert.deepEqual(topSellers(["A"], sold), []);
  assert.deepEqual(topSellers(["B", "B"], sold, 3, 3), [{ ma: "B", sold: 9 }]);
});
