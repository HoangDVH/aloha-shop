export function customerReviewTarget(account: { roles: string[]; siStatus?: string | null; ctvStatus?: string | null }): "si" | "ctv" | "account" {
  if (account.roles.includes("si") && account.siStatus === "cho_duyet") return "si";
  if (account.roles.includes("ctv") && account.ctvStatus === "cho_duyet") return "ctv";
  return "account";
}
