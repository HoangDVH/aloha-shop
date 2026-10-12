import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as chart from "../frontend/lib/topProductChart.js";
import * as business from "../frontend/lib/businessOverview.js";

function nodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  return [node, ...[].concat(node.props?.children || []).flatMap(nodes)];
}
function fixture(state: any = { isLoading: true }) {
  let index = 0, query: any;
  const slots: any[] = [], exports: any = {}, calls: string[] = [];
  const jsx = (type: any, props: any) => ({ type, props });
  const source = ts.transpileModule(readFileSync("frontend/components/admin/BusinessOverview.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, Intl, require(name: string) {
    if (name === "react") return { useState(initial: any) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (value: any) => { slots[i] = value; }]; } };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-query") return { useQuery(opts: any) { query = opts; return { ...state, refetch() {} }; } };
    if (name === "next/link") return { default: "link" };
    if (name === "lucide-react") return { Banknote: "icon", ShoppingBag: "icon", ReceiptText: "icon", RefreshCw: "icon" };
    if (name === "./website/api") return { websiteApi: async (url: string) => { calls.push(url); } };
    if (name === "./TopChartSelect") return { TopChartSelect: "period" };
    if (name === "./SalesOverviewChart") return { SalesOverviewChart: "sales-chart" };
    if (name === "./ConversionOverview") return { ConversionOverview: "funnel" };
    if (name === "@/lib/topProductChart") return chart;
    if (name === "@/lib/businessOverview") return business;
    throw new Error(name);
  } });
  return { render() { index = 0; return exports.BusinessOverview(); }, get query() { return query; }, calls };
}
test("sales and conversion use one date filter and hour/day requests; invalid range disables fetching", async () => {
  const f = fixture();
  let tree = f.render();
  nodes(tree).find(n => n.type === "period").props.onChange("week");
  tree = f.render();
  assert.equal(f.query.queryKey[3], "day");
  assert.equal((Date.parse(f.query.queryKey[2]) - Date.parse(f.query.queryKey[1])) / 86400_000, 6);
  await f.query.queryFn(); assert.match(f.calls[0], /group=day/);
  nodes(tree).find(n => n.type === "period").props.onChange("custom"); tree = f.render();
  nodes(tree).find(n => n.type === "input" && n.props.type === "date").props.onChange({ target: { value: "" } });
  tree = f.render(); assert.equal(f.query.enabled, false); assert.ok(nodes(tree).some(n => n.props.role === "alert"));
});
test("failed refresh hides stale revenue and conversion, offers retry and preserves layout", () => {
  const state = { isError: true, error: new Error("offline"), data: { sales: { summary: { revenue: 999 } } } };
  const tree = fixture(state).render();
  assert.equal(nodes(tree).filter(n => n.type === "sales-chart").length, 0);
  assert.equal(nodes(tree).find(n => n.type === "funnel").props.data, undefined);
  assert.equal(nodes(tree).filter(n => n.props.role === "alert").length, 1);
  assert.ok(nodes(tree).some(n => n.type === "button" && n.props.children === "Thử lại"));
});

function conversionTree(visits: number) {
  const exports: any = {}, jsx = (type: any, props: any) => ({ type, props });
  const source = ts.transpileModule(readFileSync("frontend/components/admin/ConversionOverview.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, Intl, require(name: string) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@/lib/businessOverview") return business;
    throw new Error(name);
  } });
  const funnel = { visits, cart: 1, checkout: 1, placed: 1, transitions: { cart: 1, checkout: 1, placed: 1 }, trackingSince: "2026-10-12T08:00:00Z" };
  return exports.ConversionOverview({ data: { ...funnel, previous: funnel }, compare: false });
}
test("conversion shows total-traffic rates, continuation counts, small samples and collapsible help", () => {
  const tree = conversionTree(2), all = nodes(tree);
  const text = (node: any): string => node == null ? "" : typeof node !== "object" ? String(node) : [].concat(node.props?.children || []).map(text).join("");
  assert.match(text(tree), /Dữ liệu còn ít: 2 phiên/);
  assert.match(text(tree), /50% trên tổng truy cập/);
  assert.match(text(tree), /Tiếp tục 50%/);
  assert.match(text(tree), /Chưa tiếp tục: 1 phiên/);
  assert.equal(all.filter(n => n.type === "li").length, 4);
  assert.equal(all.find(n => n.type === "details").props.open, undefined);
  assert.doesNotMatch(text(conversionTree(30)), /Dữ liệu còn ít/);
});
