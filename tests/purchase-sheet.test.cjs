const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const jsx = (type, props) => ({ type, props: props || {} });
const code = ts.transpileModule(fs.readFileSync("frontend/components/pdp/ProductPurchaseSheet.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(overrides = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return { useEffect() {}, useId: () => "purchase", useRef: value => ({ current: value }), useState: value => [value, () => {}] };
    if (name === "lucide-react") return { Minus: "minus", Plus: "plus", X: "x" };
    if (name === "@/lib/api") return { formatVnd: value => String(value) };
    throw new Error(name);
  }});
  const props = { name: "Plant", price: 85000, qty: 1, maxQty: 3, disabled: false, pending: false, status: "", selection: "", preOrder: false,
    onQty: value => calls.push(value), onClose: () => calls.push("close"), onBuy: () => calls.push("buy"), ...overrides };
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== "object") return [];
    return [node, ...walk(node.props.children)];
  }
  const nodes = walk(exports.ProductPurchaseSheet(props));
  return { calls, nodes, input: nodes.find(n => n.type === "input"), buttons: nodes.filter(n => n.type === "button") };
}
test("quantity input clamps empty, negative, decimal and excessive values", () => {
  const f = fixture();
  for (const value of ["", "-5", "2.9", "999"]) f.input.props.onChange({ target: { value } });
  assert.deepEqual(f.calls, [1, 1, 2, 3]);
});
test("quantity controls disable at lower and upper bounds", () => {
  const first = fixture(), last = fixture({ qty: 3 });
  assert.equal(first.buttons.find(n => n.props.children?.type === "minus").props.disabled, true);
  assert.equal(last.buttons.find(n => n.props.children?.type === "plus").props.disabled, true);
});
test("rapid confirmation invokes purchase once", () => {
  const f = fixture(), confirm = f.buttons.at(-1);
  confirm.props.onClick(); confirm.props.onClick();
  assert.deepEqual(f.calls, ["buy"]);
});
test("unavailable purchase disables confirmation", () => {
  assert.equal(fixture({ disabled: true }).buttons.at(-1).props.disabled, true);
});
test("cancel closes without purchasing", () => {
  const f = fixture();
  f.nodes.find(n => n.type === "dialog").props.onCancel();
  assert.deepEqual(f.calls, ["close"]);
});
