import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "../frontend/lib/homeWholesaleOrder.js";

function compile(path: string, require: (name: string) => unknown) {
  const exports = {} as Record<string, any>;
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require });
  return exports;
}
const pot = { ma: "P", nhomPath: "CHẬU TRỒNG CÂY" };
const tree = { ma: "C", nhomPath: "CÂY CẢNH ĐỦ LOẠI >> CÂY PHONG THỦY" };
const finished = { ma: "F", nhomPath: "CÂY CẢNH ĐỦ LOẠI >> CÂY THÀNH PHẨM SALE" };

function hookFixture() {
  let user: any = null, data: any, options: any, campaign: any = null;
  const calls: any[] = [], responses: any[] = [];
  const hook = compile("frontend/lib/useWholesaleHomeProducts.ts", name => {
    if (name === "react") return { useEffect: () => {} };
    if (name === "@/lib/catalogSync") return { onShopCatalogChanged: () => () => {} };
    if (name === "@tanstack/react-query") return { useQueryClient: () => ({ invalidateQueries: () => {} }), useQuery: (opts: unknown) => { options = opts; return { data }; } };
    if (name === "@/components/ShopAuthProvider") return { useShopAuth: () => ({ user }) };
    if (name === "@/lib/api") return { fetchProducts: async (opts: unknown) => { calls.push(opts); const response = responses.shift(); return Array.isArray(response) ? { items: response } : response || { items: [] }; } };
    if (name === "@/lib/campaign/useCampaignView") return { useCampaignView: () => ({ campaign }) };
    if (name.includes("homeWholesaleOrder")) return policy;
    throw new Error(name);
  }).useWholesaleHomeProducts;
  return { hook, calls, responses, get options() { return options; }, setUser: (v: unknown) => { user = v; },
    setData: (v: unknown) => { data = v; }, setCampaign: (v: unknown) => { campaign = v; } };
}

test("retail/guest keeps original order and makes no wholesale request; login/logout switches order", () => {
  const f = hookFixture(), products = [finished, tree, pot], query = { badge: "noi_bat" };
  assert.deepEqual(f.hook(products, query, 3), products);
  assert.equal(f.options.enabled, false);
  f.setUser({ id: "H", roles: ["si"], siStatus: "active", siRegion: "HCM" });
  assert.deepEqual(f.hook(products, query, 3).map((p: any) => p.ma), ["P", "C", "F"]);
  assert.equal(f.options.enabled, true);
  const hcmKey = JSON.stringify(f.options.queryKey);
  f.setUser({ id: "T", roles: ["si"], siStatus: "active", siRegion: "TINH" });
  f.hook(products, query, 3);
  assert.notEqual(JSON.stringify(f.options.queryKey), hcmKey);
  f.setData([pot, tree]);
  f.setUser(null);
  assert.deepEqual(f.hook(products, query, 3), products);
  assert.equal(f.options.enabled, false);
  assert.equal(f.calls.length, 0);
});

test("wholesale request preserves section filters and sends ordering before server pagination", async () => {
  const f = hookFixture();
  f.setUser({ id: "H", roles: ["si"], siStatus: "active", siRegion: "HCM" });
  f.responses.push([pot, tree, finished]);
  f.hook([], { badge: "noi_bat", categoryId: 123, sort: "moi", inStock: true }, 6);
  const signal = new AbortController().signal;
  const result = await f.options.queryFn({ signal });
  assert.equal(f.calls[0].homeOrder, "wholesale");
  assert.equal(f.calls[0].badge, "noi_bat");
  assert.equal(f.calls[0].categoryId, 123);
  assert.equal(f.calls[0].sort, "moi");
  assert.equal(f.calls[0].limit, 6);
  assert.equal(f.calls[0].signal, signal);
  assert.deepEqual(result.map((p: any) => p.ma), ["P", "C", "F"]);
});

test("deal fallback combines eligible groups before truncating, deduplicates, and refreshes when campaign changes", async () => {
  const f = hookFixture();
  f.setUser({ id: "T", roles: ["si"], siStatus: "active", siRegion: "TINH" });
  f.responses.push([finished], [finished, pot, tree]);
  f.hook([], { badge: "uu_dai", sort: "ten" }, 3);
  const before = JSON.stringify(f.options.queryKey);
  assert.deepEqual((await f.options.queryFn({})).map((p: any) => p.ma), ["P", "C", "F"]);
  assert.equal(f.calls[1].badge, "ban_chay_sap_het");
  f.setCampaign({ id: "new", products: [{ ma: "P" }] });
  f.hook([], { badge: "uu_dai", sort: "ten" }, 3);
  assert.notEqual(JSON.stringify(f.options.queryKey), before);
});

test("finished sections move last only for approved wholesale viewers", () => {
  let user: any = null;
  const jsx = (type: unknown, props: any) => ({ type, props });
  const render = compile("frontend/components/HomeSectionOrder.tsx", name => {
    if (name === "react") return { Fragment: "fragment" };
    if (name === "react/jsx-runtime") return { Fragment: "fragment", jsx, jsxs: jsx };
    if (name === "@/components/ShopAuthProvider") return { useShopAuth: () => ({ user }) };
    if (name.includes("homeWholesaleOrder")) return policy;
    throw new Error(name);
  }).HomeSectionOrder;
  const sections = [{ id: "finished", finished: true, node: "finished" }, { id: "new", finished: false, node: "new" },
    { id: "sale", finished: true, node: "sale" }, { id: "featured", finished: false, node: "featured" }];
  const ids = () => Array.from(render({ sections }).props.children, (c: any) => c.props.children);
  assert.deepEqual(ids(), ["finished", "new", "sale", "featured"]);
  for (const siRegion of ["HCM", "TINH"]) {
    user = { roles: ["si"], siStatus: "active", siRegion };
    assert.deepEqual(ids(), ["new", "featured", "finished", "sale"]);
  }
  user = { roles: ["si"], siStatus: "cho_duyet", siRegion: "HCM" };
  assert.deepEqual(ids(), ["finished", "new", "sale", "featured"]);
});

test("configured private offers never fill from common bestseller products", async () => {
  const f = hookFixture();
  f.setUser({ id: "H", roles: ["si"], siStatus: "active", siRegion: "HCM" });
  f.responses.push({ items: [pot], homeAudience: "wholesale" });
  f.hook([], { badge: "uu_dai" }, 12);
  assert.deepEqual((await f.options.queryFn({})).map((p: any) => p.ma), ["P"]);
  assert.equal(f.calls.length, 1);
});

test("private view-more renders no product data before session resolves, then selects only the verified viewer profile", async () => {
  let user: any = null, loading = true, options: any;
  const calls: any[] = [];
  const jsx = (type: unknown, props: any) => ({ type, props });
  const render = compile("frontend/components/WholesaleHomeCatalog.tsx", name => {
    if (name === "react") return { useEffect: () => {} };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-query") return { useQueryClient: () => ({}), useQuery: (opts: any) => { options = opts; return { isPending: true }; } };
    if (name === "@/components/ShopAuthProvider") return { useShopAuth: () => ({ user, loading }) };
    if (name === "@/components/ProductCard") return { ProductGrid: "grid" };
    if (name === "@/components/CatalogLayout") return { CatalogLayout: "layout" };
    if (name === "@/lib/catalogSync") return { onShopCatalogChanged: () => () => {} };
    if (name === "@/lib/api") return { fetchProducts: async (opts: any) => { calls.push(opts); return { items: [] }; } };
    if (name.includes("homeWholesaleOrder")) return policy;
    throw new Error(name);
  }).WholesaleHomeCatalog;
  const query = { badge: "noi_bat", page: 2, limit: 25 };
  const initial = render({ query });
  assert.equal(options.enabled, false);
  assert.equal(initial.props.children.props.children[2], null);
  loading = false;
  render({ query });
  await options.queryFn({});
  assert.equal(calls[0].homeOrder, undefined);
  user = { id: "H", roles: ["si"], siStatus: "active", siRegion: "HCM" };
  render({ query });
  await options.queryFn({});
  assert.equal(calls[1].homeOrder, "wholesale"); assert.equal(calls[1].page, 2);
});
