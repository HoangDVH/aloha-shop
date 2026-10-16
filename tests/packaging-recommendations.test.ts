import test from "node:test";
import assert from "node:assert/strict";
import { withPackagingRecommendations } from "../backend/shopCatalog/catalog/packagingRecommendations.js";
import { toPublicProduct } from "../backend/shopCatalog/catalog/publicProduct.js";
import * as publicProduct from "../backend/shopCatalog/catalog/publicProduct.js";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("whole-plant dimensions select the reviewed bag and boxes", () => {
  assert.deepEqual(withPackagingRecommendations("PTNTS", []), ["TNTSH5", "HKV21X31", "HKT30X35"]);
  assert.deepEqual(withPackagingRecommendations("TPTTCT", []), ["HKV21X31", "HKT30X35", "TGMK", "TNTSH3"]);
  // 20cm canopy needs more than the 21cm square box once clearance is included.
  assert.deepEqual(withPackagingRecommendations("TPVLDB", []), ["HKT30X35"]);
});

test("existing pot suggestions survive; packaging is case-insensitively deduplicated", () => {
  const original = ["POT_A", "tntsh5", "HKV21X31", "ptnts"];
  assert.deepEqual(withPackagingRecommendations(" ptnts ", original), ["POT_A", "tntsh5", "HKV21X31", "HKT30X35"]);
  assert.deepEqual(original, ["POT_A", "tntsh5", "HKV21X31", "ptnts"]);
});

test("unreviewed plants, raw plants and carton variants do not inherit guesses", () => {
  for (const ma of ["LYTSCV", "TPNNHP", "TXRMT20", "TNTSH5", "UNKNOWN", "constructor", "__proto__"]) {
    assert.deepEqual(withPackagingRecommendations(ma, ["EXISTING"]), ["EXISTING"], ma);
  }
});

test("purchase history adds packaging to each reviewed plant without losing existing suggestions", () => {
  const expected: Record<string, string[]> = {
    CBCTAN: ["HKT32X46", "TKV31"], CBDLHP: ["TNTSH4"], CBDVTU: ["TGMK", "TNTSH4", "TVTDDL"],
    CBHPMM: ["TNTSH4"], CBKNPL: ["TNTSH4"], CBKNTV: ["TGMK"],
    CBKTAN: ["TNTSH3", "TGMK"], CBKTTL: ["TGMK"], CBPTPQ: ["TGMK"],
    KN3GMOB: ["TGMK"], KNCT: ["TGMK"], KTMM: ["TNTSH3", "TGMK"],
    TPKNAK: ["TGMK"], TPPTNY: ["TGMK"], TPTNCT: ["TGMK"], TPTSDC: ["TVMN"], TPTSDL: ["TVMN"],
  };
  for (const [ma, bags] of Object.entries(expected)) {
    const saved = ["POT_A", bags[0].toLowerCase()];
    const actual = toPublicProduct({ ma: ma.toLowerCase(), attachedItems: saved, giaWeb: 100000 }).attachedItems!;
    assert.deepEqual(actual, ["POT_A", bags[0].toLowerCase(), ...bags.slice(1)], ma);
    assert.deepEqual(saved, ["POT_A", bags[0].toLowerCase()]);
    assert(!actual.includes("TGMKN"));
  }
});

test("ambiguous mixed orders and four-plants/one-bag transactions are not auto-assigned", () => {
  for (const ma of ["TP170", "CBDVTT", "CBLHCG", "LMMDBN"]) {
    assert.deepEqual(withPackagingRecommendations(ma, []), [], ma);
  }
  // Older unambiguous invoices support different bags for these two plants.
  assert.deepEqual(withPackagingRecommendations("KNHP", []), ["TGMK"]);
  assert.deepEqual(withPackagingRecommendations("CBDVPL", []), ["TNTSH4"]);
});

test("one-year history expands reviewed pairs while keeping carton variants separate", () => {
  const expected: Record<string, string[]> = {
    CBDVAN: ["TKV31"], CBDVDP: ["TVTDDL"], CBDVPL: ["TNTSH4"],
    CBPTTT: ["TGMK"], CBVMHN: ["TGMK"], KNHP: ["TGMK"], KTPT: ["TKV31"],
    LYTS28: ["TCK60L"], TP160: ["TGMK"], TP80: ["TVMN"], TPKGCT: ["TNTSH4"],
    TPKTNY: ["TGMK"], TPKTTV: ["TCK60L", "TGMK", "TNTSH4"], TPLCTC: ["TGMK"],
    TPPTSL01: ["TKV31"], TPTCGS: ["TVMN"], TPTTP: ["TCK61"],
    TPXRMN: ["TVMN"], XRMT20: ["TCK60S"],
  };
  for (const [ma, bags] of Object.entries(expected)) {
    assert.deepEqual(withPackagingRecommendations(ma.toLowerCase(), []), bags, ma);
  }
  assert.deepEqual(withPackagingRecommendations("TLYTS28", []), []);
  assert.deepEqual(withPackagingRecommendations("TXRMT20", []), []);
});

test("public API attachments include packaging for PDP and buy-now selection without changing saved data", () => {
  const doc = { ma: "PTNTS", ten: "CHẬU PHÁT TÀI NHẬT THỦY SINH", giaWeb: 150000, ton: 2,
    attachedItems: [{ productCode: "POT_A" }, { ma: "TNTSH5" }], images: ["https://example.com/plant.jpg"] };
  const before = JSON.stringify(doc);
  assert.deepEqual(toPublicProduct(doc).attachedItems, ["POT_A", "TNTSH5", "HKV21X31", "HKT30X35"]);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(toPublicProduct({ ma: "OTHER", giaWeb: 10000 }).attachedItems, undefined);
});

test("detail and slug routes load packaging through current prices, stock holds and public filters", async () => {
  const main = { ma: "PTNTS", ten: "Phat tai", giaWeb: 150000, ton: 2, attachedItems: ["POT_A"] };
  const attachments = ["HKT30X35", "TNTSH5", "POT_A", "HKV21X31"].map(ma => ({ ma, giaWeb: 20000, ton: 8 }));
  let reads = 0;
  const db = { collection: () => ({
    findOne: async () => main,
    find(filter: any) {
      reads++;
      assert.deepEqual(JSON.parse(JSON.stringify(filter.$and.slice(0, -1))), publicProduct.shopFilterBase().$and);
      const requested = Array.from(filter.$and.at(-1).$or[0].ma.$in);
      assert.deepEqual(requested, ["POT_A", "TNTSH5", "HKV21X31", "HKT30X35"]);
      return { toArray: async () => attachments };
    },
  }) };
  const exports: any = {};
  const code = ts.transpileModule(readFileSync("backend/shopCatalog/routes/productDetail.routes.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name: string) {
    if (name.endsWith("/publicProduct.js")) return { ...publicProduct, findByProductSlug: async () => main };
    if (name.endsWith("/types.js")) return { COL: "aloha_products" };
    if (name.endsWith("/cors.js")) return { setCors() {} };
    if (name.endsWith("/shopVariantGroup.js")) return { isComboOrFormulaProduct: () => false };
    if (name.endsWith("/categoryMeta.js")) return {
      loadCategoryMetaById: async () => new Map(), overlayProductCategoryFields: (p: any) => p,
    };
    if (name.endsWith("/priceOverlay.js")) return {
      loadPriceBooksByMa: async () => new Map(), applyPriceBookOverlay: (p: any) => p,
    };
    if (name.endsWith("/stockHold.js")) return {
      availableTonAfterHold: async (_db: any, _ma: string, ton: number) => ton - 1,
      subtractHeldFromPublicItems: async (_db: any, items: any[]) => items.map(p => ({ ...p, ton: p.ton - 1 })),
    };
    if (name.endsWith("/checkoutFlags.js")) return { isShopTestBuyerEmail: () => false };
    if (name.endsWith("/priceContext.js")) return { requestShopBuyerEmail: () => "" };
    if (name.endsWith("/catalogPromos.js")) return {
      withCampaignPromos: async (_db: any, _req: any, items: any[]) => ({ items: items.map(p => ({ ...p, gia: p.gia - 1000 })) }),
    };
    throw new Error(name);
  } });
  const routes = new Map();
  exports.registerProductDetailRoutes({ get: (path: string, handler: any) => routes.set(path, handler) }, { catalogDb: async () => db });
  for (const path of ["/api/shop/products/:ma", "/api/shop/resolve"]) {
    let body: any;
    const res = { setHeader() {}, json(value: any) { body = value; }, status(status: number) { throw new Error(`Unexpected HTTP ${status}`); } };
    await routes.get(path)({ params: { ma: "PTNTS" }, query: { productSlug: "phat-tai--ptnts" } }, res);
    assert.deepEqual(Array.from(body.item.attachedProducts, (p: any) => p.ma), ["POT_A", "TNTSH5", "HKV21X31", "HKT30X35"]);
    assert.equal(body.item.attachedProducts[1].ton, 7);
    assert.equal(body.item.attachedProducts[1].gia, 19000);
    assert.deepEqual(body.item.attachedItems, ["POT_A", "TNTSH5", "HKV21X31", "HKT30X35"]);
  }
  assert.equal(reads, 2);
});
