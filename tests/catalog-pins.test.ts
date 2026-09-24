import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { arrangeByAbsolutePin } from "../backend/shopCatalog/pinArrange.js";
import { WEB_BADGE_VALUES } from "../backend/shopCatalog/webBadge.js";

// Execute the actual revenue route branch, with only DB/pricing adapters mocked.
// This catches pagination/query mistakes that testing the pin helper alone misses.
const source = readFileSync(new URL("../backend/shopCatalog/register.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("register.ts", source, ts.ScriptTarget.Latest, true);
let branch: ts.Block | undefined;
function visit(node: ts.Node) {
  if (ts.isIfStatement(node) && node.expression.getText(ast) === "rankedMas.length") {
    branch = node.thenStatement as ts.Block;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(branch, "Revenue branch must exist");
const code = ts.transpileModule(`(async () => ${branch!.getText(ast)})()`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

type Product = { ma: string; ten: string; webBadge: string; webPin: number; gia: number; ton: number; image: boolean };
function products(badge: string): Product[] {
  return Array.from({ length: 8 }, (_, i) => ({
    ma: `P${i}`, ten: `Product ${i}`, webBadge: badge,
    webPin: i === 7 ? 4 : 0, gia: 100, ton: 2, image: true,
  }));
}
async function request(docs: Product[], badge: string, options: {
  page?: number; limit?: number; maxTon?: number; inStock?: boolean; rank?: Map<string, number>;
} = {}) {
  const { page = 1, limit = 20, maxTon = 0, inStock = false } = options;
  const rank = options.rank ?? new Map(docs.slice(0, 5).map((p, i) => [p.ma, 100 - i]));
  const filter = { webBadge: badge };
  const col = {
    find(query: any) {
      const rankedOnly = query.$and?.some((x: any) => x.$expr?.$in);
      const rows = docs.filter(p => p.webBadge === badge && (!rankedOnly || rank.has(p.ma)));
      return { project() { return this; }, async toArray() { return rows; } };
    },
  };
  const result = await vm.runInNewContext(code, {
    col, db: {}, filter, and: [filter], projection: {}, rank,
    rankedMas: [...rank.keys()], badge, maxTon, inStock,
    minPrice: 0, maxPrice: 0, page, limit, skip: (page - 1) * limit,
    normalizeMa: (ma: string) => ma.trim().toUpperCase(), arrangeByAbsolutePin,
    mapDocsToPublicWithPriceBooks: async (_db: unknown, rows: Product[]) => ({ docs: rows, items: rows }),
    dedupeListItems: (_rows: Product[], items: Product[]) => items,
    filterRequirePublicImage: (items: Product[]) => items.filter(p => p.image),
  });
  return JSON.parse(JSON.stringify(result));
}

for (const badge of WEB_BADGE_VALUES) {
  test(`${badge}: an unranked product pinned at 4 precedes ranked products`, async () => {
    const result = await request(products(badge), badge);
    assert.equal(result.items[3].ma, "P7");
    assert.equal(result.total, 8);
    assert.equal(result.ranked, 5);
  });
  test(`${badge}: absolute pins survive pagination without gaps or duplicates`, async () => {
    const docs = products(badge);
    const pages = await Promise.all([1, 2, 3].map(page => request(docs, badge, { page, limit: 3 })));
    assert.equal(pages[1].items[0].ma, "P7");
    const merged = pages.flatMap(p => p.items.map((x: Product) => x.ma));
    const all = await request(docs, badge);
    assert.deepEqual(merged, all.items.map((x: Product) => x.ma));
    assert.equal(new Set(merged).size, 8);
    assert.ok(pages.every(p => p.total === 8 && p.pages === 3));
  });
  test(`${badge}: a ranked product can be pinned beyond the ranked group`, async () => {
    const docs = products(badge); docs[7].webPin = 0; docs[0].webPin = 7;
    const result = await request(docs, badge);
    assert.equal(result.items[6].ma, "P0");
  });
}

test("low-stock remains restricted to ranked products with eligible stock", async () => {
  const docs = products("ban_chay_sap_het"); docs[0].ton = 0; docs[1].ton = 9;
  docs[2].webPin = 2;
  const result = await request(docs, "ban_chay_sap_het", { maxTon: 8 });
  assert.equal(result.total, 3);
  assert.equal(result.items[1].ma, "P2");
  assert.ok(result.items.every((p: Product) => !["P0", "P1", "P7"].includes(p.ma)));
});
test("stock and image filtering happen before pinning, counting and pagination", async () => {
  const docs = products("noi_bat"); docs[0].ton = 0; docs[1].image = false;
  const result = await request(docs, "noi_bat", { inStock: true, limit: 4 });
  assert.equal(result.items[3].ma, "P7");
  assert.equal(result.total, 6);
  assert.equal(result.pages, 2);
  assert.equal(result.ranked, 3);
});
test("an ineligible pinned product is not reinserted", async () => {
  const docs = products("dat_truoc"); docs[7].image = false;
  const result = await request(docs, "dat_truoc");
  assert.equal(result.total, 7);
  assert.ok(result.items.every((p: Product) => p.ma !== "P7"));
});
test("ranked products retain revenue order and unranked products retain name order", async () => {
  const docs = products("giam_gia"); docs[7].webPin = 0;
  const rank = new Map([["P4", 10], ["P2", 0], ["P0", -10]]);
  const result = await request(docs.reverse(), "giam_gia", { rank });
  assert.deepEqual(result.items.map((p: Product) => p.ma), ["P4", "P2", "P0", "P1", "P3", "P5", "P6", "P7"]);
});
test("pins remain scoped to the selected label", async () => {
  const docs = products("noi_bat");
  docs.push({ ...docs[7], ma: "OTHER", webBadge: "giam_gia", webPin: 1 });
  const result = await request(docs, "noi_bat");
  assert.equal(result.total, 8);
  assert.equal(result.items[3].ma, "P7");
  assert.ok(result.items.every((p: Product) => p.ma !== "OTHER"));
});
test("out-of-range pages return no products with a consistent total", async () => {
  const result = await request(products("moi"), "moi", { page: 9, limit: 3 });
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 8);
});
