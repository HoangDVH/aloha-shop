const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const jsx = (type, props) =>
  typeof type === "function" ? type(props || {}) : { type, props: props || {} };
const code = ts.transpileModule(
  fs.readFileSync("frontend/components/pdp/ProductMobileVariantSelector.tsx", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText;

function loadModule() {
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "lucide-react") {
        return {
          LayoutGrid: (props) => jsx("svg-layout-grid", props),
          ChevronRight: (props) => jsx("svg-chevron-right", props),
        };
      }
      throw new Error("Unexpected module: " + name);
    },
  });
  return exports;
}

function walk(node) {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!node || typeof node !== "object") return [];
  return [node, ...walk(node.props?.children)];
}

test("ProductMobileVariantSelector renders selected variant with TikTok Shop format", () => {
  const mod = loadModule();
  let clicked = false;
  const props = {
    axes: [{ name: "Màu sắc", kind: "attr", values: [] }],
    selectedLabel: "Purple",
    thumbnails: [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
    ],
    needPick: false,
    qty: 2,
    unit: "cái",
    onClick: () => {
      clicked = true;
    },
  };

  const vnode = mod.ProductMobileVariantSelector(props);
  const nodes = walk(vnode);

  // Checks button click
  const button = nodes.find((n) => n.type === "button");
  assert.ok(button, "Must render a button container");
  button.props.onClick();
  assert.equal(clicked, true, "onClick must be invoked when button clicked");

  // Checks icon
  const icon = nodes.find((n) => n.type === "svg-layout-grid");
  assert.ok(icon, "Must include 4-square LayoutGrid icon");

  // Checks images
  const imgs = nodes.filter((n) => n.type === "img");
  assert.equal(imgs.length, 3, "Must render 3 thumbnail images");
  assert.equal(imgs[0].props.src, "https://example.com/1.jpg");

  // Checks text format: Đã chọn: 【Purple】 2 cái
  const jsonStr = JSON.stringify(nodes);
  assert.ok(jsonStr.includes("Đã chọn:"), "Must include 'Đã chọn:'");
  assert.ok(jsonStr.includes("Purple"), "Must include 'Purple'");
  assert.ok(jsonStr.includes("【") && jsonStr.includes("】"), "Must include brackets");
  assert.ok(jsonStr.includes("2") && jsonStr.includes("cái"), "Must include quantity");

  // Checks chevron
  const chevron = nodes.find((n) => n.type === "svg-chevron-right");
  assert.ok(chevron, "Must include ChevronRight icon");
});

test("ProductMobileVariantSelector renders 'Chọn: ...' when needPick is true", () => {
  const mod = loadModule();
  const props = {
    axes: [
      { name: "Màu sắc", kind: "attr", values: [] },
      { name: "Dung lượng", kind: "attr", values: [] },
    ],
    selectedLabel: "",
    thumbnails: [],
    needPick: true,
    qty: 1,
    unit: "sản phẩm",
    onClick: () => {},
  };

  const vnode = mod.ProductMobileVariantSelector(props);
  const nodes = walk(vnode);
  const jsonStr = JSON.stringify(nodes);

  assert.ok(jsonStr.includes("Chọn:"), "Must include 'Chọn:'");
  assert.ok(
    jsonStr.includes("Màu sắc, Dung lượng"),
    "Must list required axes"
  );
  assert.ok(!jsonStr.includes("Đã chọn:"), "Must not say 'Đã chọn:' when needPick");
});

test("ProductMobileVariantSkeleton renders loading placeholders", () => {
  const mod = loadModule();
  const vnode = mod.ProductMobileVariantSkeleton();
  const nodes = walk(vnode);
  assert.ok(nodes.length > 0, "Skeleton must render nodes");
});

test("ProductVariantPicker sheet renders withImages options in grid-cols-3 and no fieldset", () => {
  const pickerCode = ts.transpileModule(
    fs.readFileSync("frontend/components/ProductVariantPicker.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;

  const exports = {};
  vm.runInNewContext(pickerCode, {
    exports,
    require: (name) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return { useState: (v) => [v, () => {}], useEffect() {}, useMemo: (fn) => fn() };
      if (name === "lucide-react") return { Maximize2: () => jsx("icon-zoom"), Check: () => jsx("icon-check") };
      if (name === "@/lib/api") return { fetchProductVariants: async () => ({}) };
      throw new Error("Unexpected require: " + name);
    },
  });

  const axes = [
    {
      name: "SIZE",
      kind: "attr",
      values: [
        { value: "SỐ 1", image: "https://example.com/1.jpg", available: true },
        { value: "SỐ 2", image: "https://example.com/2.jpg", available: true },
        { value: "SỐ 3", image: "https://example.com/3.jpg", available: true },
        { value: "SỐ 4", image: "https://example.com/4.jpg", available: true },
        { value: "SỐ 5", image: "https://example.com/5.jpg", available: true },
        { value: "SỐ 6", image: "https://example.com/6.jpg", available: true },
      ],
    },
  ];

  const vnode = exports.ProductVariantPicker({
    axes,
    selected: {},
    onPick: () => {},
    sheet: true,
  });

  const nodes = walk(vnode);

  // Must NOT contain fieldset
  const fieldset = nodes.find((n) => n.type === "fieldset");
  assert.equal(fieldset, undefined, "Must not use <fieldset> which breaks mobile horizontal overflow");

  // Must contain grid-cols-3
  const grid = nodes.find((n) => typeof n.props?.className === "string" && n.props.className.includes("grid-cols-3"));
  assert.ok(grid, "Must render grid-cols-3 container like TikTok Shop");

  // All 6 buttons must be rendered
  const buttons = nodes.filter((n) => n.type === "button");
  assert.equal(buttons.length, 6, "All 6 options must be rendered and visible in grid");
});
