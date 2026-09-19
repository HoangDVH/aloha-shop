export function formatVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

/** Trạng thái HH phía CTV — tiếng đời thường, không thuật ngữ kế toán */
export type CtvCommissionStatusKey =
  | "held"
  | "eligible"
  | "billed"
  | "paid_out"
  | "cancelled"
  | "flagged"
  | "none";

export const CTV_COMMISSION_UX: Record<
  CtvCommissionStatusKey,
  { label: string; explain: string; color: string }
> = {
  held: {
    label: "Đang giữ",
    explain: "Đơn mới giao, chờ hết thời gian đổi/trả",
    color: "orange",
  },
  eligible: {
    label: "Sắp nhận",
    explain: "Đã đủ điều kiện, chờ shop chi",
    color: "green",
  },
  billed: {
    label: "Đang chi",
    explain: "Shop đã chốt vào đợt thanh toán lần này",
    color: "blue",
  },
  paid_out: {
    label: "Đã nhận",
    explain: "Đã chuyển tiền",
    color: "cyan",
  },
  cancelled: {
    label: "Không được nhận",
    explain: "Đơn hủy / không tính hoa hồng",
    color: "default",
  },
  flagged: {
    label: "Đang kiểm tra",
    explain: "Shop đang rà soát, tạm chưa chi",
    color: "magenta",
  },
  none: {
    label: "Chưa phát sinh",
    explain: "Đơn chưa giao xong nên chưa có hoa hồng",
    color: "default",
  },
};

/** Ưu tiên: cần chú ý → đang xử lý tiền → đã xong */
export function resolveCtvCommissionStatus(
  statuses: Array<string | null | undefined>
): CtvCommissionStatusKey {
  const set = new Set(
    statuses.map((s) => String(s || "").trim().toLowerCase()).filter(Boolean)
  );
  if (!set.size) return "none";
  if (set.has("flagged")) return "flagged";
  if (set.has("billed")) return "billed";
  if (set.has("eligible")) return "eligible";
  if (set.has("held")) return "held";
  if (set.has("paid_out")) return "paid_out";
  if (set.has("cancelled")) return "cancelled";
  // API đã map sẵn nhãn Việt
  for (const [key, ux] of Object.entries(CTV_COMMISSION_UX) as Array<
    [CtvCommissionStatusKey, { label: string }]
  >) {
    if ([...set].some((s) => s === ux.label.toLowerCase() || s === key)) {
      if (key !== "none") return key;
    }
  }
  if ([...set].some((s) => s.includes("kiểm tra") || s.includes("kiem tra")))
    return "flagged";
  if ([...set].some((s) => s.includes("không được") || s.includes("khong duoc")))
    return "cancelled";
  if ([...set].some((s) => s.includes("đang chi") || s.includes("dang chi")))
    return "billed";
  if ([...set].some((s) => s.includes("sắp nhận") || s.includes("sap nhan")))
    return "eligible";
  if ([...set].some((s) => s.includes("đang giữ") || s.includes("tạm giữ")))
    return "held";
  if ([...set].some((s) => s.includes("đã nhận") || s.includes("đã chi")))
    return "paid_out";
  if ([...set].some((s) => s.includes("chưa phát sinh"))) return "none";
  return "none";
}

export function ctvCommissionHint(
  key: CtvCommissionStatusKey,
  opts?: {
    holdDays?: number;
    period?: string | null;
    paidAt?: string | null;
  }
): string {
  const base = CTV_COMMISSION_UX[key]?.explain || "";
  if (key === "held" && opts?.holdDays) {
    return `Còn chờ hết ${opts.holdDays} ngày đổi/trả`;
  }
  if (key === "billed" && opts?.period) {
    const m = /^(\d{4})-(\d{2})$/.exec(opts.period);
    if (m) return `Thuộc đợt chi tháng ${Number(m[2])}/${m[1]}`;
  }
  if (key === "paid_out" && opts?.paidAt) {
    const d = new Date(opts.paidAt);
    if (Number.isFinite(d.getTime())) {
      return `Đã chuyển ngày ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }
  return base;
}

export function formatMoneyCompact(n: number) {
  const v = Math.round(n || 0);
  if (v >= 1_000_000_000)
    return `${(v / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ đồng`;
  if (v >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu đồng`;
  if (v >= 10_000)
    return `${(v / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k đồng`;
  return `${v.toLocaleString("vi-VN")} đồng`;
}

export function formatCompact(n: number) {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tỷ`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (n >= 10_000)
    return `${(n / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString("vi-VN");
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthRange(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    from: ymd(start),
    to: ymd(end),
    label: `${pad2(start.getDate())}-${pad2(start.getMonth() + 1)}-${start.getFullYear()} - ${pad2(end.getDate())}-${pad2(end.getMonth() + 1)}-${end.getFullYear()}`,
  };
}

export function formatDt(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) {
    const s = String(v);
    return s.length >= 16 ? s.slice(0, 16).replace("T", " ") : s.slice(0, 10);
  }
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatPeriodLabel(period: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return { title: period, range: period };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0);
  return {
    title: `Tháng ${mo} ${y}`,
    range: `${pad2(start.getDate())}/${pad2(mo)}/${y} – ${pad2(end.getDate())}/${pad2(mo)}/${y}`,
  };
}

export function dayKeyFromIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) {
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : null;
  }
  return ymd(d);
}

export function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const body = [headers.map(esc).join(",")]
    .concat(rows.map((r) => r.map(esc).join(",")))
    .join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
