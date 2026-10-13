import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { WEBSITE_SECTIONS, websiteSection } from "../frontend/components/admin/website/navigation.js";

const jsx = (type: any, props: any) => ({ type, props });
function nodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function load(file: string, tab: string | null, pathname = "/admin/website") {
  const exports: any = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require(name: string) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return { useId: () => "website-menu", useEffect() {}, useState: (initial: any) => [initial, () => {}] };
    if (name === "next/navigation") return { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(tab ? { tab } : {}) };
    if (name === "next/link") return { default: "link" };
    if (name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    if (name.endsWith("/navigation") || name === "./navigation") return { WEBSITE_SECTIONS, websiteSection };
    if (name.endsWith("useAdminSession")) return { useAdminSession: () => ({ user: {}, logout: {} }) };
    if (name.endsWith("AdminOpsSync")) return { useAdminBadgeCounts: () => ({}) };
    if (name.endsWith("adminFetch")) return {};
    if (name.endsWith("QuoteRequestsAdmin")) return { QuoteRequestsAdmin: "QuoteRequestsAdmin", QUOTE_COUNT_EVENT: "quotes" };
    if (name === "./ui") return { WB: { accent: "green" } };
    const component = name.split("/").at(-1)!;
    return { [component]: component };
  } });
  return exports;
}

test("website sections have no overview and old or missing tabs default to appearance", () => {
  assert.deepEqual(WEBSITE_SECTIONS.map(s => s.tab), ["giao-dien", "qua-tang", "bao-gia", "hang-hoa-web", "bai-viet"]);
  for (const value of [null, "tong-quan", "invalid"]) assert.equal(websiteSection(value).tab, "giao-dien");
});

test("URL controls the selected website content with no duplicate horizontal tab buttons", () => {
  const components = ["ShopAppearanceEditor", "ShopGiftsAdmin", "QuoteRequestsAdmin", "ShopWebProductsAdmin", "ShopArticlesAdmin"];
  WEBSITE_SECTIONS.forEach((section, i) => {
    const tree = load("frontend/components/admin/website/WebsiteBanHangShell.tsx", section.tab).default();
    const rendered = nodes(tree);
    assert.deepEqual(rendered.filter(n => components.includes(n.type)).map(n => n.type), [components[i]]);
    assert.equal(rendered.filter(n => n.type === "button").length, 0);
  });
});

test("sidebar exposes five website links, highlights selection and closes mobile navigation after a link", () => {
  for (const section of WEBSITE_SECTIONS) {
    let closed = 0;
    const tree = load("frontend/components/admin/shell/AdminSidebar.tsx", section.tab).AdminSidebar({ onNavigate: () => closed++ });
    const rendered = nodes(tree);
    const links = rendered.filter(n => n.type === "link" && n.props.href?.startsWith("/admin/website"));
    assert.equal(links.length, 5);
    assert.equal(links.find(n => n.props["aria-current"] === "page")?.props.href, `/admin/website?tab=${section.tab}`);
    const nav = rendered.find(n => n.type === "nav");
    nav.props.onClick({ target: { closest: () => ({}) } });
    assert.equal(closed, 1);
    nav.props.onClick({ target: { closest: () => null } });
    assert.equal(closed, 1);
  }
});

test("removed promotion reports are absent from navigation; an old reports URL falls back to campaigns", () => {
  const tree = load("frontend/components/admin/shell/AdminSidebar.tsx", "reports", "/admin/uu-dai").AdminSidebar();
  const links = nodes(tree).filter(n => n.type === "link" && n.props.href?.startsWith("/admin/uu-dai"));
  assert.equal(links.length, 4);
  assert.equal(links.some(n => n.props.href.includes("tab=reports")), false);
  assert.equal(links.find(n => n.props["aria-current"] === "page").props.href, "/admin/uu-dai?tab=campaigns");
});
