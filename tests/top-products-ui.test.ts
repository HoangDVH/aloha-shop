import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as chart from "../frontend/lib/topProductChart.js";

function fixture(kind: "sales" | "views", state: any = { data: { items: [] }, isPending: false }) {
  let index = 0, query: any;
  const slots: any[] = [], calls: string[] = [];
  const exports: any = {}, jsx = (type: any, props: any) => ({ type, props });
  const code = ts.transpileModule(readFileSync("frontend/components/admin/TopProductsOverview.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + "\nexports.ChartCard = ChartCard;";
  vm.runInNewContext(code, { exports, Date, Intl, require(name: string) {
    if (name === "react") return { useState(initial: any) { const n = index++; if (!(n in slots)) slots[n] = typeof initial === "function" ? initial() : initial; return [slots[n], (value: any) => slots[n] = value]; } };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-query") return { useQuery(opts: any) { query = opts; return { ...state, refetch() {} }; } };
    if (name === "lucide-react") return { RefreshCw: "refresh" };
    if (name === "./TopChartSelect") return { TopChartSelect: "select" };
    if (name === "./website/api") return { websiteApi: async (url: string) => { calls.push(url); return { items: [] }; } };
    if (name === "@/lib/topProductChart") return chart;
    throw new Error(name);
  } });
  return { render() { index = 0; return exports.ChartCard({ kind }); }, get query() { return query; }, calls };
}
function allNodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  return [node, ...[].concat(node.props?.children || []).flatMap(allNodes)];
}
test("each card keeps its own metric/time state and sends the selected metric to the API", async () => {
  const sales = fixture("sales"), views = fixture("views");
  const tree = sales.render(); views.render();
  assert.equal(sales.query.queryKey[2], "revenue"); assert.equal(views.query.queryKey[2], "views");
  const selects = allNodes(tree).filter(n => n.type === "select");
  selects[0].props.onChange("quantity"); selects[1].props.onChange("previousMonth");
  sales.render(); views.render();
  assert.equal(sales.query.queryKey[2], "quantity"); assert.equal(views.query.queryKey[2], "views");
  await sales.query.queryFn({ signal: undefined });
  assert.match(sales.calls[0], /kind=sales&metric=quantity/);
  assert.ok(sales.query.queryKey[3] < sales.query.queryKey[4]);
});
test("empty/error responses show a real message instead of fabricated bars", () => {
  const empty = fixture("views").render();
  assert.equal(allNodes(empty).filter(n => n.type === "li").length, 0);
  const error = fixture("sales", { isError: true, error: new Error("offline") }).render();
  assert.equal(allNodes(error).filter(n => n.props?.role === "alert").length, 1);
  assert.equal(allNodes(error).filter(n => n.type === "li").length, 0);
});
test("long product names remain available in full through titles and labels escape as text", () => {
  const name = "Cây rất dài <script>alert(1)</script>";
  const tree = fixture("sales", { data: { items: [{ ma: "P", name, unit: "CÁI", value: 18200000 }] }, isPending: false }).render();
  const row = allNodes(tree).find(n => n.type === "li");
  assert.ok(row.props.title.includes(name));
  assert.equal(allNodes(tree).some(n => n.props?.dangerouslySetInnerHTML), false);
});
