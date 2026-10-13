import { SI_TERMS_VERSION } from "./policy.js";

/** Legacy admin grants are recognized from their trusted permission audit. */
export function wholesaleApprovalBasis(account: any): "customer_terms" | "admin_grant" | null {
  if (account.siProfile?.acceptedTermsAt && account.siProfile.termsVersion === SI_TERMS_VERSION) return "customer_terms";
  if (!account.roles?.includes("si") || account.siApplicationSource === "customer") return null;
  if (account.siApplicationSource === "admin") return "admin_grant";
  // A submitted customer profile must still satisfy the current terms gate.
  if (account.siProfile || account.siLookupId) return null;
  const changes = (account.permissionsAudit || []).filter((a: any) =>
    Array.isArray(a.fromRoles) && Array.isArray(a.toRoles) &&
    a.fromRoles.includes("si") !== a.toRoles.includes("si"));
  const last = changes.at(-1);
  return last?.toRoles.includes("si") && last.actorAdminId && last.reason ? "admin_grant" : null;
}
