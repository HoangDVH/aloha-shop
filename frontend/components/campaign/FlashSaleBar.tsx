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
export function FlashSaleBar({ p }: { p: DealProgress }) {
  const label = formatDealBarLabel(p);

  if (p.state === "upcoming") {
    return (
      <div className="flex h-[18px] items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200" suppressHydrationWarning title={label}>
        <span className={`${TEXT} px-2 text-amber-800`}>⏰ {label}</span>
      </div>
    );
  }
  if (p.state === "soldOut") {
    return (
      <div className="flex h-[18px] items-center justify-center rounded-full bg-neutral-200" title={label}>
        <span className={`${TEXT} px-2 text-neutral-500`}>{label}</span>
      </div>
    );
  }

  const fill = p.state === "fresh" || p.state === "live" ? 0 : Math.max(p.pct, 6);
  return (
    <div className="relative mt-1.5" title={label}>
      <span className="pointer-events-none absolute -left-1 -top-[7px] z-20 text-[17px] leading-none drop-shadow-sm" aria-hidden>
        🔥
      </span>
      <div className="relative flex h-[18px] items-center justify-center overflow-hidden rounded-full bg-[#F87171]">
        {fill > 0 ? (
          <span
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#F97316] to-[#B91C1C] ${p.state === "low" ? "animate-pulse" : ""}`}
            style={{ width: `${fill}%` }}
            aria-hidden
          />
        ) : (
          <span className="aloha-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" aria-hidden />
        )}
        <span className={`${TEXT} text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]`}>{label}</span>
      </div>
    </div>
  );
}
