import test from "node:test";
import assert from "node:assert/strict";
import { customerReviewTarget } from "../frontend/lib/customerReviewTarget.js";

test("pending wholesale and CTV accounts open their submitted profile directly", () => {
  assert.equal(customerReviewTarget({ roles: ["si"], siStatus: "cho_duyet" }), "si");
  assert.equal(customerReviewTarget({ roles: ["ctv"], ctvStatus: "cho_duyet" }), "ctv");
  assert.equal(customerReviewTarget({ roles: ["si", "ctv"], siStatus: "active", ctvStatus: "cho_duyet" }), "ctv");
  assert.equal(customerReviewTarget({ roles: ["si", "ctv"], siStatus: "cho_duyet", ctvStatus: "cho_duyet" }), "si");
});

test("ordinary accounts retain the account detail flow and stale statuses without roles do not open review", () => {
  for (const account of [
    { roles: ["customer"] }, { roles: ["si"], siStatus: "active" },
    { roles: ["ctv"], ctvStatus: "active" }, { roles: ["customer"], siStatus: "cho_duyet", ctvStatus: "cho_duyet" },
  ]) assert.equal(customerReviewTarget(account), "account");
});
