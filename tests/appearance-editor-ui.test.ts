import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const jsx = (type: any, props: any) => ({ type, props });
function nodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function label(node: any): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(label).join("");
  return node?.props ? label(node.props.children) : "";
}
function load(file: string, mobile = false) {
  const exports: any = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require(name: string) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return { useEffect() {}, useRef: () => ({ current: null }), useState: (v: any) => [v, () => {}] };
    if (name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    if (name === "antd") return { Dropdown: "dropdown", Modal: "modal", Grid: { useBreakpoint: () => ({ lg: !mobile }) } };
    if (name.endsWith("/ui")) return { WbBtn: "button", WbBadge: "badge", WbIconSegment: "device", WbField: "field", WbSectionLabel: "section-label" };
    if (name.endsWith("editorUtils")) return { formatScheduleVi: () => "date", combineLocalToIso: () => "date" };
    if (name.endsWith("BlockList")) return { BlockList: "blocks", BLOCK_LABEL: {} };
    return {};
  } });
  return exports;
}

test("compact header preserves draft and publish callbacks and moves device controls out of the toolbar", () => {
  let saved = 0, published = 0, toggled = 0;
  const tree = load("frontend/components/admin/website/appearance/EditorHeader.tsx").EditorHeader({
    history: [], toolsOpen: false, primary: "green", previewOpen: false,
    syncPreview: () => saved++, applyPublish: () => published++, onTogglePreview: () => toggled++,
  });
  const all = nodes(tree);
  const buttons = all.filter(n => n.type === "button");
  assert.equal(buttons.length, 4);
  buttons.find(n => label(n) === "Lưu nháp").props.onClick();
  buttons.find(n => label(n) === "Áp dụng").props.onClick();
  buttons.find(n => label(n) === "Website hiện tại").props.onClick();
  assert.deepEqual([saved, published, toggled], [1, 1, 1]);
  assert.equal(buttons.filter(n => n.props.variant === "primary").length, 1);
  assert.equal(all.some(n => n.type === "device"), false);
});

test("one add-block dropdown preserves both product and article actions", () => {
  let products = 0, articles = 0;
  const tree = load("frontend/components/admin/website/appearance/panels/HomePanel.tsx").HomePanel({
    draft: { blocks: [] }, addProductSection: () => products++, addArticleSection: () => articles++,
  });
  const dropdown = nodes(tree).find(n => n.type === "section-label").props.action;
  assert.equal(dropdown.props.menu.items.length, 2);
  dropdown.props.menu.onClick({ key: "product" });
  dropdown.props.menu.onClick({ key: "article" });
  assert.deepEqual([products, articles], [1, 1]);
  assert.equal(nodes(dropdown).filter(n => n.type === "button").length, 1);
});

test("website preview uses compact desktop panel and a separate mobile modal with close control", () => {
  for (const mobile of [false, true]) {
    let closed = 0;
    const tree = load("frontend/components/admin/website/appearance/EditorPreview.tsx", mobile).EditorPreview({
      device: "desktop", setDevice() {}, onClose: () => closed++, iframeRef: { current: null }, shopPreviewUrl: "https://example.com", previewSrc: "https://example.com/?_preview=1", previewKey: 1,
    });
    assert.equal(tree.type, mobile ? "modal" : "aside");
    if (!mobile) assert.match(tree.props.className, /w-\[35%\]/);
    const all = nodes(tree);
    assert.equal(all.filter(n => n.type === "device").length, 1);
    all.find(n => n.props?.["aria-label"] === "Đóng website hiện tại").props.onClick();
    assert.equal(closed, 1);
    const link = all.find(n => n.type === "a");
    assert.equal(link.props.href, "https://example.com");
  }
});
