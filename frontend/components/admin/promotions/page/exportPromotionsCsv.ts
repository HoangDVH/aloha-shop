import dayjs from "dayjs";
import { mysteryValueText, type PromotionItem } from "../form/promotionFormModel";

/** Xuất danh sách đợt phát hành ra CSV (kiểu KiotViet). Trả false nếu không có dữ liệu. */
export function exportPromotionsToCsv(promotions: PromotionItem[]): boolean {
  if (promotions.length === 0) return false;
  const headers = [
    "Mã đợt phát hành",
    "Tên đợt phát hành",
    "Từ ngày",
    "Đến ngày",
    "Số lượng",
    "Mệnh giá",
    "Trạng thái",
  ];
  const rows = promotions.map((p) => [
    `"${p.id}"`,
    `"${(p.name || "").replace(/"/g, '""')}"`,
    p.startDate ? dayjs(p.startDate).format("DD/MM/YYYY") : "—",
    p.endDate ? dayjs(p.endDate).format("DD/MM/YYYY") : "Vô thời hạn",
    p.usageLimitTotal != null ? p.usageLimitTotal : "∞",
    mysteryValueText(p) || (p.discountType === "percentage" ? `${p.discountValue}%` : p.discountValue),
    p.status === "active" ? "Đang kích hoạt" : p.status === "paused" ? "Tạm dừng" : "Bản nháp",
  ]);
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `kiotviet_voucher_${dayjs().format("YYYYMMDD_HHmmss")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
