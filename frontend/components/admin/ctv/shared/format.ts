export function formatVnd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** DD-MM-YYYY HH:mm — cùng format báo cáo CTV */
export function formatDt(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) {
    const s = String(v);
    return s.length >= 16 ? s.slice(0, 16).replace("T", " ") : s.slice(0, 10);
  }
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function maskPhone(phone: string | null | undefined): string {
  const s = String(phone || "").trim();
  if (s.length < 4) return s || "—";
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export function maskAccountNumber(raw: string | null | undefined): string {
  const s = String(raw || "").replace(/\s/g, "");
  if (s.length < 4) return s || "—";
  return `***${s.slice(-4)}`;
}

/** Nhãn trạng thái cộng tác viên — viết đủ nghĩa */
export const CTV_STATUS_LABEL: Record<string, string> = {
  cho_duyet: "Chờ duyệt",
  active: "Hoạt động",
  khoa: "Tạm dừng",
};

/** Nhãn vòng đời hoa hồng — viết đủ nghĩa, không viết tắt */
export const COMMISSION_STATUS_LABEL: Record<string, string> = {
  held: "Đang giữ (chờ hết đổi trả)",
  eligible: "Đủ điều kiện chi",
  billed: "Đã vào kỳ thanh toán",
  paid_out: "Đã thanh toán",
  cancelled: "Đã hủy",
  flagged: "Nghi ngờ gian lận",
};
