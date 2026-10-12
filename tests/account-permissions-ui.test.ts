import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function nodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  return [node, ...[].concat(node.props?.children || []).flatMap(nodes)];
}
function fixture(account: any) {
  const slots: any[] = [], exports: any = {}, calls: any[] = [];
  let index = 0, mutation: any;
  const jsx = (type: any, props: any) => ({ type, props });
  const source = ts.transpileModule(readFileSync("frontend/components/admin/customers/AccountPermissions.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name: string) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return { useEffect() {}, useState(initial: any) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: any) => { slots[i] = value; }]; } };
    if (name === "@tanstack/react-query") return { useQueryClient: () => ({ setQueryData() {}, invalidateQueries() {} }),
      useMutation(opts: any) { mutation = opts; return { isPending: false, mutate: () => opts.mutationFn() }; } };
    if (name === "antd") return { Alert: "alert", Button: "button", Checkbox: "checkbox", Input: Object.assign("input", { TextArea: "textarea" }), Radio: { Group: "radio" }, message: { success() {} } };
    if (name === "lucide-react") return { ShieldCheck: "icon" };
    if (name === "@/lib/siQueries") return { siRequest: async (path: string, body: any, method: string) => { calls.push({ path, body, method }); return { user: account }; } };
    throw new Error(name);
  } });
  return { render() { index = 0; return exports.AccountPermissions({ account, onChanged() {}, onWholesale() {} }); }, calls, get mutation() { return mutation; } };
}
test("account permission editor requires reason and sends explicit roles with original revision", async () => {
  const f = fixture({ id: "A", roles: ["customer"], active: true, permissionsRevision: 3 });
  let tree = f.render();
  const save = () => nodes(tree).find(n => n.type === "button" && n.props.children === "Lưu phân quyền");
  assert.equal(save().props.disabled, true);
  nodes(tree).find(n => n.type === "radio").props.onChange({ target: { value: "wholesale" } });
  nodes(tree).find(n => n.type === "checkbox").props.onChange({ target: { checked: true } });
  tree = f.render(); assert.equal(save().props.disabled, true);
  nodes(tree).find(n => n.type === "textarea").props.onChange({ target: { value: "Đã xác nhận" } });
  tree = f.render(); assert.equal(save().props.disabled, false);
  await f.mutation.mutationFn();
  assert.equal(f.calls[0].path, "/api/shop/admin/accounts/A/permissions");
  assert.equal(f.calls[0].method, "PATCH"); assert.equal(f.calls[0].body.customerType, "wholesale");
  assert.equal(f.calls[0].body.ctv, true); assert.equal(f.calls[0].body.activateCtv, true);
  assert.equal(f.calls[0].body.expected.revision, 3); assert.deepEqual(f.calls[0].body.expected.roles, ["customer"]);
});
test("changing customer type keeps pending CTV unchanged unless admin explicitly activates it", async () => {
  const f = fixture({ id: "A", roles: ["customer", "ctv"], ctvStatus: "cho_duyet", ctvCode: "OLDCTV", active: false });
  let tree = f.render();
  assert.ok(nodes(tree).some(n => n.type === "alert" && n.props.type === "warning"));
  nodes(tree).find(n => n.type === "radio").props.onChange({ target: { value: "wholesale" } });
  tree = f.render(); await f.mutation.mutationFn(); assert.equal(f.calls[0].body.activateCtv, false);
  nodes(tree).find(n => n.type === "button" && n.props.children === "Kích hoạt quyền CTV").props.onClick();
  f.render(); await f.mutation.mutationFn(); assert.equal(f.calls[1].body.activateCtv, true);
  assert.equal(f.calls[1].body.ctvCode, "OLDCTV");
});
