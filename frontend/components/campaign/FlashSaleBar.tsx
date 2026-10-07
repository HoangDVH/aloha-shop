import type { DealProgress } from "@/lib/campaign/dealProgress";

const TEXT = "relative z-10 truncate px-2 text-[9.5px] sm:text-[10px] font-black uppercase tracking-tight";

function formatDealBarLabel(p: DealProgress): string {
  if (p.state === "low") {
    // Trích số suất còn lại từ p.left (ví dụ "Chỉ còn 3 suất cuối!" -> 3)
    const match = p.left.match(/\d+/);
    const qty = match ? match[0] : "";
    return qty ? `CHỈ CÒN ${qty} SUẤT` : "SẮP CHÁY HÀNG";
  }
  if (p.state === "soldOut") {
    return "ĐÃ HẾT SUẤT SALE";
  }
  return p.right ? `${p.left} · ${p.right}` : p.left;
}

/**
 * Thanh suất Flash Sale kiểu sàn TMĐT: chữ nằm trong thanh, lửa ở đầu thanh.
 * Phần tô chỉ là tỉ lệ đã bán thật; lúc chưa ai mua thì chạy vệt sáng thay vì tô giả.
 */
export function FlashSaleBar({ p }: { p?: DealProgress }) {
  return null;
}
