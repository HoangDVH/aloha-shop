import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { merchFields, overlaySiMerch } from "../backend/shopAppearance/merchAudience.js";
import { webBadgeMongoFilter } from "../backend/shopCatalog/webBadge.js";

const source = readFileSync(new URL("../backend/shopCatalog/routes/products.routes.ts", import.meta.url), "utf8");
const start = source.indexOf("        const db = await ctx.catalogDb();");
const end = source.indexOf("        const col = db.collection(COL);", start);
const code = ts.transpileModule(`(async()=>{${source.slice(start, end)}return { filter, homeAudience, mapped: await mapHomeDocs(db, docsInput) };})()`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const docs = [{ ma: "POT", webBadge: "giam_gia", webPin: 9, webSiFeatured: true, webSiFeaturedPin: 2, webSiDeals: true, webSiDealsPin: 7 }];

async function request(badge: string, mode: string, configured = true, wholesaleHome = true) {
  return vm.runInNewContext(code, {
    ctx: { catalogDb: async () => ({ collection: () => ({ findOne: async () => configured ? { _id: 1 } : null }) }) },
    COL: "aloha_products", badge, currentPriceMode: () => mode, wholesaleHome, merchFields, overlaySiMerch,
    mapDocsToPublicWithPriceBooks: async (_db: unknown, rows: unknown[]) => rows,
    shopFilterBase: () => ({}), webBadgeMongoFilter, gift: "", giftCodes: [], q: "", categoryIdList: [], nhomList: [],
    homeScope: false, maxTon: 0, inStock: false, attrFilters: [], dvtFilters: [], loai: "", dealMas: [],
    mongoAttrFilter: () => null, mongoDvtFilter: () => null, mongoLoaiFilter: () => null,
    sort: "ten", voucher: null, docsInput: docs,
  });
}

test("approved SI presentation selects its own memberships and pins", async () => {
  for (const [badge, field, pin] of [["noi_bat", "webSiFeatured", 2], ["uu_dai", "webSiDeals", 7]] as const) {
    const r = await request(badge, "si");
    assert.equal(r.homeAudience, "wholesale");
    assert.equal(r.filter.$and[0][field], true);
    assert.equal(r.mapped[0].webBadge, badge); assert.equal(r.mapped[0].webPin, pin);
  }
  assert.equal(docs[0].webBadge, "giam_gia"); assert.equal(docs[0].webPin, 9);
});

test("guest cannot request private memberships by passing the presentation parameter", async () => {
  const r = await request("noi_bat", "web");
  assert.equal(r.homeAudience, "common"); assert.equal(r.filter.$and[0].webBadge, "noi_bat");
  assert.equal(r.mapped[0].webBadge, "giam_gia");
});

test("an unconfigured private list falls back to common; ordinary catalog requests retain common", async () => {
  for (const r of [await request("noi_bat", "si", false), await request("noi_bat", "si", true, false)]) {
    assert.equal(r.homeAudience, "common"); assert.equal(r.filter.$and[0].webBadge, "noi_bat");
  }
});
