import test from "node:test";
import assert from "node:assert/strict";
import { directoryFilter } from "../backend/shopAuth/directoryFilters.js";
import { requireDirectoryResponse } from "../frontend/lib/customerDirectoryResponse.js";

// In-memory fixture evaluator for the Mongo operators used by the directory.
function matches(doc: Record<string, any>, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and") return expected.every((part: any) => matches(doc, part));
    if (key === "$or") return expected.some((part: any) => matches(doc, part));
    const values = Array.isArray(doc[key]) ? doc[key] : [doc[key]];
    if (expected && typeof expected === "object") return Object.entries(expected).every(([op, value]) => {
      if (op === "$in") return values.some((v: any) => (value as any[]).includes(v));
      if (op === "$nin") return values.every((v: any) => !(value as any[]).includes(v));
      if (op === "$ne") return !values.includes(value);
      throw new Error(`Unsupported test operator: ${op}`);
    });
    return values.includes(expected);
  });
}
const accounts = [
  { id: "retail", roles: ["customer"], active: true },
  { id: "ctv-only", roles: ["ctv"], ctvStatus: "active", active: true },
  { id: "hcm-ctv", roles: ["customer", "si", "ctv"], siRegion: "HCM", siStatus: "active", ctvStatus: "active", active: true },
  { id: "province-locked", roles: ["customer", "si"], siRegion: "TINH", siStatus: "khoa", active: false },
  { id: "pending-both", roles: ["si", "ctv"], siStatus: "cho_duyet", ctvStatus: "cho_duyet", active: true },
  { id: "missing-region", roles: ["si"], siRegion: null, siStatus: "tu_choi", active: true },
  { id: "unrelated", roles: ["staff"] },
];
const ids = (query: Record<string, unknown>) => accounts.filter(a => matches(a, directoryFilter(query))).map(a => a.id);

test("directory includes CTV-only accounts and lists each combined-role account once", () => {
  assert.deepEqual(ids({}), ["retail", "ctv-only", "hcm-ctv", "province-locked", "pending-both", "missing-region"]);
});
test("retail excludes every wholesale application, including pending and rejected profiles", () => {
  assert.deepEqual(ids({ customerType: "retail" }), ["retail", "ctv-only"]);
  assert.deepEqual(ids({ customerType: "unassigned" }), ["pending-both", "missing-region"]);
});
test("customer region and affiliate status can be combined independently", () => {
  assert.deepEqual(ids({ customerType: "HCM", affiliate: "active" }), ["hcm-ctv"]);
  assert.deepEqual(ids({ customerType: "HCM", affiliate: "none" }), []);
  assert.deepEqual(ids({ customerType: "retail", affiliate: "member" }), ["ctv-only"]);
});
test("locked wholesale accounts keep their region and can be found by both status filters", () => {
  assert.deepEqual(ids({ customerType: "TINH", accountState: "locked", wholesaleStatus: "khoa" }), ["province-locked"]);
  assert.deepEqual(ids({ customerType: "TINH", accountState: "active" }), []);
});
test("pending queue counts a person with two pending applications only once", () => {
  assert.deepEqual(ids({ pending: "1" }), ["pending-both"]);
  assert.deepEqual(ids({ pending: "1", customerType: "HCM" }), []);
});
test("category counts partition the directory while affiliate counts overlap", () => {
  const categories = ["retail", "HCM", "TINH", "unassigned"].flatMap(customerType => ids({ customerType }));
  assert.equal(categories.length, ids({}).length);
  assert.equal(new Set(categories).size, categories.length);
  assert.equal(ids({ affiliate: "member" }).length, 3);
});
test("invalid filters are rejected instead of silently returning all customers", () => {
  for (const key of ["customerType", "affiliate", "wholesaleStatus", "accountState"]) {
    assert.throws(() => directoryFilter({ [key]: "invalid" }), /không hợp lệ/);
  }
});

test("the UI refuses an old API response that silently ignores every filter", () => {
  assert.throws(() => requireDirectoryResponse({ items: accounts, total: accounts.length }), /Máy chủ chưa cập nhật/);
  const filtered = { directoryVersion: 1, items: [accounts[2]], total: 1 };
  assert.equal(requireDirectoryResponse(filtered), filtered);
  assert.deepEqual(requireDirectoryResponse({ directoryVersion: 1, items: [], total: 0 }).items, []);
});
