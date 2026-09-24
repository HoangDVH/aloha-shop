const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const Fragment = Symbol("fragment");
const jsx = (type, props, key) => ({ type, props: props || {}, key });
const source = fs.readFileSync("frontend/components/catalog/CatalogMobileCategories.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(panel = null, query = "") {
  let calls = [], count = 0;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment };
    if (name === "react") return {
      Fragment, Children: { toArray: c => (Array.isArray(c) ? c.flat(Infinity) : [c]).filter(x => x != null && x !== false) },
      isValidElement: x => x && typeof x === "object" && "props" in x,
      useState: () => [count++ === 0 ? panel : query, value => calls.push(value)],
      useEffect() {}, useRef: () => ({ current: null }), useId: () => "dialog-title",
    };
    if (name === "next/link") return { default: "a" };
    if (name === "lucide-react") return { Check: "check", ChevronDown: "down", Search: "search", X: "x" };
    throw new Error(name);
  }});
  const props = {
    groups: [0,1,2].map(i => ({ label: "Branch " + i, title: "Group " + i, active: i === 1, options: [
      { id: 1, label: "Binh An", href: "/danh-muc/binh-an", active: true },
      { id: 2, label: "Duoi Cong", href: "/danh-muc/duoi-cong?categoryId=1&categoryId=2", active: false },
    ] })),
    selected: [jsx("a", { children: "Selected 1" }), jsx("a", { children: "Selected 2" })],
    filters: jsx(Fragment, { children: [jsx("button", { children: "Price" }), jsx("button", { children: "Stock" })] }),
    onNavigate: () => calls.push("navigate"),
  };
  return { render: () => exports.CatalogMobileCategories(props), props, calls };
}
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props?.children)];
}
test("mobile renders three single-line branch buttons and only two selected chips", () => {
  const f = fixture(), nodes = elements(f.render());
  const buttons = nodes.filter(n => n.type === "button" && n.props["aria-haspopup"] === "dialog");
  assert.equal(buttons.length, 4);
  assert.ok(buttons.slice(0,3).every(n => n.props.className.includes("whitespace-nowrap")));
  assert.equal(nodes.filter(n => n.type === "a").length, 2);
  assert.deepEqual(Array.from(buttons[3].props.children), ["+", 2]);
  buttons[3].props.onClick();
  assert.ok(f.calls.includes("selected"));
});
test("overflow includes both category choices and secondary filters", () => {
  const f = fixture("selected"), nodes = elements(f.render());
  const dialog = nodes.find(n => n.type === "dialog");
  const content = elements(dialog);
  assert.ok(content.some(n => n.props.children === "Price"));
  assert.ok(content.some(n => n.props.children === "Stock"));
  assert.ok(content.some(n => n.props.children === "Selected 2"));
  dialog.props.onCancel();
  assert.ok(f.calls.includes(null));
});
test("branch options retain existing navigation URLs and close on selection", () => {
  const f = fixture(1), nodes = elements(f.render());
  const link = nodes.find(n => n.type === "a" && n.props.href?.includes("categoryId"));
  assert.equal(link.props.href, "/danh-muc/duoi-cong?categoryId=1&categoryId=2");
  link.props.onClick();
  assert.deepEqual(f.calls, [null, "navigate"]);
});
test("search filters the branch without navigating or making requests", () => {
  const f = fixture(1, "duoi"), nodes = elements(f.render());
  const links = nodes.filter(n => n.type === "a" && n.props.href);
  assert.equal(links.length, 1);
  assert.ok(links[0].props.href.includes("duoi-cong"));
  assert.deepEqual(f.calls, []);
});
test("no overflow button when two or fewer choices are applied", () => {
  const f = fixture(); f.props.filters = null;
  const buttons = elements(f.render()).filter(n => n.type === "button" && n.props["aria-haspopup"] === "dialog");
  assert.equal(buttons.length, 3);
});
