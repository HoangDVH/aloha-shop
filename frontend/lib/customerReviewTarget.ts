export function customerReviewTarget(account: {
  roles?: string[];
  siStatus?: string | null;
  ctvStatus?: string | null;
  siVerificationStatus?: string | null;
  siVerification?: { status?: string | null } | null;
}): "si" | "ctv" | "account" {
  const roles = Array.isArray(account?.roles) ? account.roles : [];
  const isSiPending =
    roles.includes("si") &&
    (account.siStatus === "cho_duyet" ||
      account.siVerificationStatus === "pending" ||
      account.siVerification?.status === "pending" ||
      account.siStatus === "active");
  if (isSiPending) return "si";
  if (roles.includes("ctv") && account.ctvStatus === "cho_duyet") return "ctv";
  if (roles.includes("si")) return "si";
  if (roles.includes("ctv")) return "ctv";
  return "account";
}
