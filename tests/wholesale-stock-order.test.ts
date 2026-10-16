import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { orderWholesaleHomeProducts, sortWholesaleStockProducts } from "../frontend/lib/homeWholesaleOrder.js";

const pot = (ma: string, ton: number) => ({ ma, ton, nhomPath: "CHẬU TRỒNG CÂY >> CHẬU GỐM" });

test("available stock outranks sales; equal-stock pots use revenue and keep stable ties", () => {
  const input = [pot("BEST", 5), pot("HIGH", 80), pot("EQUAL_LOW", 20), pot("EQUAL_BEST", 20), pot("TIE", 20), pot("ZERO", 0), pot("NEG", -2), pot("BAD", NaN)];
  const rank = new Map([["BEST", 100000], ["EQUAL_BEST", 900], ["TIE", 900]]);
  assert.deepEqual(sortWholesaleStockProducts(input, rank).map(p => p.ma), ["HIGH", "EQUAL_BEST", "TIE", "EQUAL_LOW", "BEST", "ZERO", "NEG", "BAD"]);
  assert.equal(input[0].ma, "BEST");
});

test("home retains two-pot/one-plant layout and finished products last", () => {
  const input = [pot("LOW", 1), {ma:"F",ton:999,nhomPath:"CÂY THÀNH PHẨM TRỒNG SẴN"}, pot("HIGH", 90),
    {ma:"TREE",ton:30,nhomPath:"CÂY CẢNH ĐỦ LOẠI >> CÂY PHONG THỦY"}, pot("MID", 50)];
  assert.deepEqual(orderWholesaleHomeProducts(input).map(p=>p.ma), ["HIGH", "MID", "TREE", "LOW", "F"]);
  assert.deepEqual(orderWholesaleHomeProducts(input, false).map(p=>p.ma), ["LOW", "HIGH", "TREE", "MID", "F"]);
});

// Execute the route's actual ordering policy, including price-mode/default-sort gating.
const source = readFileSync("backend/shopCatalog/routes/products.routes.ts", "utf8");
const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ["homeOrder", "wholesaleStockFirst"].includes(node.name.getText(ast))) {
    declarations.set(node.name.getText(ast), `const ${node.getText(ast)};`);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.size, 2);
const code = ts.transpileModule(`${declarations.get("wholesaleStockFirst")}\n${declarations.get("homeOrder")}\nhomeOrder(input)`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function request(mode: string, sort: string, wholesaleHome = false) {
  return vm.runInNewContext(code, { currentPriceMode:()=>mode, sort, wholesaleHome,
    wholesaleRank:new Map([["LOW", 1000], ["MID_SALES", 100]]),
    orderWholesaleHomeProducts, sortWholesaleStockProducts,
    input:[pot("LOW",1),pot("MID",20),pot("MID_SALES",20),pot("HIGH",90)] });
}

test("approved wholesale default ordering is global before pagination; guests retain existing order", () => {
  const all = request("si", "ban_chay");
  assert.deepEqual(Array.from(all, (p:any)=>p.ma), ["HIGH", "MID_SALES", "MID", "LOW"]);
  assert.deepEqual(Array.from(all.slice(0,2), (p:any)=>p.ma), ["HIGH", "MID_SALES"]);
  assert.deepEqual(Array.from(all.slice(2,4), (p:any)=>p.ma), ["MID", "LOW"]);
  assert.deepEqual(Array.from(request("web", "ban_chay"), (p:any)=>p.ma), ["LOW", "MID", "MID_SALES", "HIGH"]);
  assert.deepEqual(Array.from(request("web", "ban_chay", true), (p:any)=>p.ma), ["LOW", "MID", "MID_SALES", "HIGH"]);
});

test("explicit price/newest/deal sorts are not overridden by wholesale stock priority", () => {
  for(const sort of ["price_asc", "price_desc", "moi", "giam_gia"]){
    assert.deepEqual(Array.from(request("si", sort), (p:any)=>p.ma), ["LOW", "MID", "MID_SALES", "HIGH"],sort);
    assert.deepEqual(Array.from(request("si", sort,true), (p:any)=>p.ma), ["LOW", "MID", "MID_SALES", "HIGH"],sort);
  }
});
