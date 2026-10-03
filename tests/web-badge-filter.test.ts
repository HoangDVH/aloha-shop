import test from "node:test";
import assert from "node:assert/strict";
import { webBadgeMongoFilter } from "../backend/shopCatalog/webBadge.js";
import { dealMasCacheSuffix } from "../backend/shopCampaigns/catalogPromos.js";

test("uu_dai filter includes running-campaign products alongside the manual badge", () => {
  assert.deepEqual(webBadgeMongoFilter("uu_dai", ["CBDVDP", "LYTSCV"]), {
    $or: [{ webBadge: "uu_dai" }, { ma: { $in: ["CBDVDP", "LYTSCV", "cbdvdp", "lytscv"] } }],
  });
});

test("uu_dai without a running campaign and other badges keep the plain filter", () => {
  assert.deepEqual(webBadgeMongoFilter("uu_dai", []), { webBadge: "uu_dai" });
  assert.deepEqual(webBadgeMongoFilter("moi", ["CBDVDP"]), { webBadge: "moi" });
  assert.deepEqual(webBadgeMongoFilter("ban_chay_sap_het"), { webBadge: { $in: ["ban_chay_sap_het", "ban_chay"] } });
  assert.equal(webBadgeMongoFilter(""), null);
});

test("cache suffix changes with the campaign product list", () => {
  assert.equal(dealMasCacheSuffix([]), "");
  assert.notEqual(dealMasCacheSuffix(["A"]), dealMasCacheSuffix(["A", "B"]));
  assert.equal(dealMasCacheSuffix(["A", "B"]), dealMasCacheSuffix(["A", "B"]));
});
