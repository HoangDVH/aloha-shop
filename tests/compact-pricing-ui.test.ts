import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { formatAppliedVoucherTitle, voucherCustomerTitle } from "../frontend/lib/voucherFormat.js";
function render(expanded = false, loading = false, title = "Voucher 5%") {
  const exports: any = {};
  const jsx = (type: any, props: any) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(readFileSync("frontend/components/pdp/ProductPricingSummary.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name: string) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@/lib/api") return { formatVnd: (n: number) => `${n}đ` };
    if (name === "@/lib/voucherFormat") return { formatAppliedVoucherTitle, voucherCustomerTitle };
    return {};
  } });
  return exports.ProductPricingSummary({ expanded, pricing: { loading, stale: false, quote: {
    subtotal: 1350000, finalTotal: 1282500, discountTotal: 67500, applied: { title },
    campaign: { volumeSavings: 150000 },
  } } });
}
function nodes(n: any): any[] { return !n || typeof n !== "object" ? [] : [n, ...[n.props?.children].flat(6).flatMap(nodes)]; }
test("PDP summary displays one breakdown and one final total using server savings", () => {
  const compact = render();
  assert.equal(nodes(compact).some(n => n.type === "details"), false);
  const text = JSON.stringify(compact);
  assert.ok(text.includes("1282500đ"));
  assert.ok(text.includes("217500đ"));
  assert.ok(text.includes("1500000đ"));
  assert.ok(text.includes("150000đ"));
  assert.ok(text.includes("67500đ"));
  assert.equal(text.split("1282500đ").length - 1, 1);
  assert.ok(text.includes("Chưa bao gồm phí vận chuyển"));
});
test("pending repricing hides the previous total", () => {
  assert.equal(JSON.stringify(render(false, true)).includes("1282500đ"), false);
});

test("PDP summary hides old product-count suffixes from voucher titles", () => {
  const text = JSON.stringify(render(false, false, "Giảm 10% đặt trước 20/10 (3 sản phẩm)"));
  assert.ok(text.includes("Giảm 10% đặt trước 20/10"));
  assert.equal(text.includes("3 sản phẩm"), false);
});
