import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { merchAudienceSchema, merchFields, merchBadge, overlaySiMerch } from "../backend/shopAppearance/merchAudience.js";
import { normalizeWebBadge } from "../backend/shopCatalog/webBadge.js";

const source = readFileSync(new URL("../backend/shopAppearance/productsAdmin.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("admin.ts", source, ts.ScriptTarget.Latest, true);
let patch = "";
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.arguments[0]?.getText(ast) === '"/api/shop/admin/products/:ma/merchandising"') {
    const handler = node.arguments[node.arguments.length - 1] as ts.ArrowFunction;
    patch = handler.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(patch);
const code = ts.transpileModule(`globalThis.handler = ${patch}`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

async function save(docs: any[], ma: string, body: any) {
  let status = 200, result: any;
  const writes: any[] = [];
  const col = {
    find(query: any) {
      const rivals = docs.filter(d => Object.entries(query).every(([key, value]: any) => {
        if (key === "_id") return d._id !== value.$ne;
        if (value?.$in) return value.$in.includes(d[key]);
        return d[key] === value;
      }));
      return { project() { return this; }, toArray: async () => rivals };
    },
    async updateOne(query: any, update: any) { writes.push(update.$set); Object.assign(docs.find(d => d._id === query._id), update.$set); },
  };
  const context: any = {
    merchAudienceSchema, merchFields, merchBadge, normalizeWebBadge,
    productsDb: async () => ({ collection: () => col }), COL: "aloha_products",
    findProductByMa: async (_col: unknown, code: string) => docs.find(d => d.ma === code),
    ensureSiMerchIndexes: async () => {}, redisInvalidateShopCache: async () => {}, syncBus: { publish() {} },
  };
  vm.runInNewContext(code, context);
  await context.handler({ params: { ma }, body }, { status(n: number) { status = n; return this; }, json(v: unknown) { result = v; } });
  return { status, result, writes };
}

const fixture = () => [
  { _id: 1, ma: "POT", webBadge: "giam_gia", webPin: 9, webSiFeatured: true, webSiFeaturedPin: 5, webSiDeals: true, webSiDealsPin: 8 },
  { _id: 2, ma: "OTHER", webBadge: "noi_bat", webPin: 1, webSiFeatured: true, webSiFeaturedPin: 1, webSiDeals: true, webSiDealsPin: 2 },
];

test("saving wholesale featured clears only its own rival pin and preserves common/deals fields", async () => {
  const docs = fixture();
  const r = await save(docs, "POT", { audience: "si_noi_bat", webBadge: "noi_bat", webPin: 1 });
  assert.equal(r.status, 200);
  assert.equal(docs[0].webSiFeaturedPin, 1);
  assert.equal(docs[1].webSiFeaturedPin, 0);
  assert.equal(docs[0].webBadge, "giam_gia"); assert.equal(docs[0].webPin, 9);
  assert.equal(docs[1].webPin, 1); assert.equal(docs[1].webBadge, "noi_bat");
  assert.equal(docs[0].webSiDealsPin, 8); assert.equal(docs[1].webSiDealsPin, 2);
});

test("one product belongs to both private lists; removing deals does not remove featured/common", async () => {
  const docs = fixture();
  await save(docs, "POT", { audience: "si_uu_dai", webBadge: "" });
  assert.equal(docs[0].webSiDeals, false); assert.equal(docs[0].webSiDealsPin, 0);
  assert.equal(docs[0].webSiFeatured, true); assert.equal(docs[0].webSiFeaturedPin, 5);
  assert.equal(docs[0].webBadge, "giam_gia"); assert.equal(docs[0].webPin, 9);
});

test("saving just a private badge preserves its private pin instead of taking the common pin", async () => {
  const docs = fixture();
  await save(docs, "POT", { audience: "si_noi_bat", webBadge: "noi_bat" });
  assert.equal(docs[0].webSiFeaturedPin, 5);
});

test("legacy common edits touch no private-list fields", async () => {
  const docs = fixture();
  await save(docs, "POT", { webBadge: "noi_bat", webPin: 1 });
  assert.equal(docs[0].webBadge, "noi_bat"); assert.equal(docs[1].webPin, 0);
  assert.equal(docs[0].webSiFeaturedPin, 5); assert.equal(docs[1].webSiFeaturedPin, 1);
  assert.equal(docs[0].webSiDealsPin, 8);
});

test("invalid audience or wrong private-list badge is rejected before writes", async () => {
  for (const body of [{ audience: "invalid", webBadge: "noi_bat" }, { audience: "si_noi_bat", webBadge: "uu_dai" },
    { audience: "si_uu_dai", webBadge: "giam_gia" }]) {
    const r = await save(fixture(), "POT", body);
    assert.equal(r.status, 400); assert.equal(r.writes.length, 0);
  }
});

test("private merchandising overlays are copies and preserve actual price/eligibility data", () => {
  const docs = fixture();
  const original = structuredClone(docs);
  const featured = overlaySiMerch(docs, "noi_bat"), deals = overlaySiMerch(docs, "uu_dai");
  assert.equal(featured[0].webBadge, "noi_bat"); assert.equal(featured[0].webPin, 5);
  assert.equal(deals[0].webBadge, "uu_dai"); assert.equal(deals[0].webPin, 8);
  assert.deepEqual(docs, original);
  assert.equal(merchBadge(docs[0], "common"), "giam_gia");
  assert.equal(merchBadge(docs[0], "si_noi_bat"), "noi_bat");
});
