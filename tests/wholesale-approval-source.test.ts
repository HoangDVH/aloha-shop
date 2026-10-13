import test from "node:test";
import assert from "node:assert/strict";
import { wholesaleApprovalBasis } from "../backend/shopWholesale/approvalSource.js";
import { SI_TERMS_VERSION } from "../backend/shopWholesale/policy.js";
test("admin grants can be approved without inventing customer consent", () => {
  const account = { roles: ["customer", "si"], siApplicationSource: "admin" };
  assert.equal(wholesaleApprovalBasis(account), "admin_grant");
  assert.equal("siProfile" in account, false);
});
test("legacy admin grant recognized from audit, not merely the si role", () => {
  const grant = { fromRoles: ["customer"], toRoles: ["customer", "si"], actorAdminId: "manager", reason: "Existing customer" };
  assert.equal(wholesaleApprovalBasis({ roles: ["si"], permissionsAudit: [grant] }), "admin_grant");
  assert.equal(wholesaleApprovalBasis({ roles: ["si"] }), null);
  assert.equal(wholesaleApprovalBasis({ roles: ["si"], permissionsAudit: [grant], siApplicationSource: "customer" }), null);
  assert.equal(wholesaleApprovalBasis({ roles: ["si"], permissionsAudit: [grant], siProfile: { termsVersion: "old" } }), null);
  assert.equal(wholesaleApprovalBasis({ roles: ["customer"], siApplicationSource: "admin" }), null);
});
test("customer applications continue to require current accepted terms", () => {
  assert.equal(wholesaleApprovalBasis({ siApplicationSource: "customer" }), null);
  assert.equal(wholesaleApprovalBasis({ siApplicationSource: "customer", siProfile: { acceptedTermsAt: "2026-10-13", termsVersion: "old" } }), null);
  assert.equal(wholesaleApprovalBasis({ siApplicationSource: "customer", siProfile: { acceptedTermsAt: "2026-10-13", termsVersion: SI_TERMS_VERSION } }), "customer_terms");
});
