import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { orderWholesaleHomeProducts, sortWholesaleStockProducts } from "../frontend/lib/homeWholesaleOrder.js";

const source = readFileSync(new URL("../backend/shopCatalog/routes/products.routes.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
let standard = "";
function visit(node: ts.Node) {
  if (ts.isIfStatement(node) && node.expression.getText(ast) === "!needPostFilter") standard = node.thenStatement.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const post = source.slice(source.indexOf("        // Lọc giá / sort"), source.indexOf("      }, TTL_SEC);"));

for (const [name, code] of [["standard", standard], ["post-filter", `{${post}}`]]) {
  test(`${name}: wholesale selection precedes limit-one shortcuts and pagination`, async () => {
    const docs = [
      { ma: "FIN", ten: "A", nhomPath: "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM SALE", gia: 100, ton: 5 },
      { ma: "TREE", ten: "B", nhomPath: "CÂY CẢNH ĐỦ LOẠI >> CÂY PHONG THỦY", gia: 100, ton: 5 },
      { ma: "POT", ten: "Z", nhomPath: "CHẬU TRỒNG CÂY >> CHẬU NHỰA", gia: 100, ton: 90 },
    ];
    const compiled = ts.transpileModule(`(async()=>${code})()`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    async function request(wholesaleHome: boolean, page = 1, limit = 1, wholesaleStockFirst = false) {
      const cursor = { project() { return this; }, sort() { return this; }, limit() { return this; }, async toArray() { return docs; } };
      return vm.runInNewContext(compiled, {
        homeAudience: "common", wholesaleHome, wholesaleStockFirst,
        homeOrder: (items: typeof docs) => {
          const ordered = wholesaleStockFirst ? sortWholesaleStockProducts(items) : items;
          return wholesaleHome ? orderWholesaleHomeProducts(ordered) : ordered;
        },
        col: { find: () => cursor, countDocuments: async () => docs.length }, db: {}, filter: {}, projection: {},
        page, limit, skip: (page - 1) * limit, badge: "noi_bat", minPrice: 0, maxPrice: 0, inStock: false, maxTon: 0,
        sort: "moi", pinScope: "", deals: new Map(), buyerEmail: "", normalizeMa: (s: string) => s,
        productCreatedMs: () => 0, mapHomeDocs: async () => ({ docs, items: docs }),
        dedupeListItems: (_docs: unknown, items: unknown[]) => items, filterZeroPriceUnlessTestBuyer: (items: unknown[]) => items,
        filterRequirePublicImage: (items: unknown[]) => items, sortPublicItems: (items: unknown[]) => items,
      });
    }
    assert.equal((await request(true)).items[0].ma, "POT");
    assert.equal((await request(true, 2)).items[0].ma, "TREE");
    assert.equal((await request(true, 3)).items[0].ma, "FIN");
    assert.equal((await request(false)).items[0].ma, "FIN");
    assert.equal((await request(false, 1, 1, true)).items[0].ma, "POT");
    assert.equal((await request(false, 2, 1, true)).items[0].ma, "FIN");
    assert.equal((await request(true)).total, 3);
  });
}
