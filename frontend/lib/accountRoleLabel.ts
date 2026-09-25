export type AccountRoleInput = {
  roles?: string[] | null;
  ctvStatus?: string | null;
  siStatus?: string | null;
  siRegion?: string | null;
};

/** Nhãn loại tài khoản trên menu và trang Tài khoản. */
export function shopAccountRoleLabel(user: AccountRoleInput): string {
  const roles = user.roles || [];
  const labels: string[] = [];

  if (roles.includes("ctv")) {
    if (user.ctvStatus === "active") labels.push("Cộng tác viên");
    else if (user.ctvStatus === "cho_duyet") labels.push("Cộng tác viên (chờ duyệt)");
    else if (user.ctvStatus === "tu_choi") labels.push("Cộng tác viên (bị từ chối)");
    else if (user.ctvStatus === "khoa") labels.push("Cộng tác viên (tạm khóa)");
  }

  if (roles.includes("si") && user.siStatus === "active") {
    if (user.siRegion === "HCM") labels.push("Khách sỉ HCM");
    else if (user.siRegion === "TINH") labels.push("Khách sỉ tỉnh");
    else labels.push("Khách sỉ");
  } else if (roles.includes("si") && user.siStatus === "cho_duyet") {
    labels.push("Khách sỉ (chờ duyệt)");
  } else if (roles.includes("si") && user.siStatus === "khoa") {
    labels.push("Khách sỉ (tạm khóa)");
  }

  return labels.length ? labels.join(" · ") : "Khách lẻ";
}
