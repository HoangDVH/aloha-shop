import type { CampaignPromoUI } from "@/lib/campaign/campaignApi";
import { formatCompactVnd } from "@/lib/voucherFormat";

type Gift = NonNullable<CampaignPromoUI["gifts"]>[number];

/** Từ mức này trở xuống mới nhắc "Còn N suất quà"; dưới GIFT_URGENT_LEFT thì đỏ. */
const GIFT_LOW_LEFT = 10;
const GIFT_URGENT_LEFT = 3;

export function giftSummary(promo: CampaignPromoUI | null | undefined): {
  text: string;
  image: string;
  value: number;
  left: number | null;
} | null {
  const gifts: Gift[] = promo?.gifts ?? [];
  if (!gifts.length) {
    const label = promo?.giftLabel?.trim() || "";
    return label ? { text: label, image: "", value: 0, left: null } : null;
  }
  const text = gifts.map((g) => (g.qty > 1 ? `${g.qty} ${g.name}` : g.name)).join(" + ");
  const value = gifts.reduce((n, g) => n + (g.value && g.value > 0 ? g.value * g.qty : 0), 0);
  const lefts = gifts.map((g) => g.left).filter((n): n is number => typeof n === "number");
  return {
    text,
    image: gifts.find((g) => g.image)?.image || "",
    value,
    left: lefts.length ? Math.min(...lefts) : null,
  };
}

/** Ô quà kiểu TGDĐ: ảnh quà thật, tên, giá trị, suất còn lại (chỉ khi có dữ liệu). */
export function DealGiftBox({ promo }: { promo: CampaignPromoUI | null | undefined }) {
  const g = giftSummary(promo);
  if (!g) return null;
  const out = g.left === 0;
  const low = g.left != null && g.left > 0 && g.left <= GIFT_LOW_LEFT;
  return (
    <div
      className={`mt-2.5 flex items-center gap-2 rounded-xl border p-1.5 sm:p-2 ${
        out ? "border-slate-200 bg-slate-50 opacity-70" : "border-[#FDE68A] bg-[#FFFBEB]/70"
      }`}
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[#FDE68A] bg-white">
        {g.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-base" aria-hidden>
            🎁
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center justify-between gap-1 whitespace-nowrap">
          <span className="min-w-0 truncate text-[9.5px] font-black uppercase tracking-wide text-[#92400E] sm:text-[10px]">
            {out ? "Đã hết quà" : "Tặng kèm"}
            {g.value > 0 && !out ? (
              <span className="ml-1 font-bold normal-case text-[#B45309]">
                <span className="hidden sm:inline">· trị giá </span>
                {formatCompactVnd(g.value).toUpperCase()}
              </span>
            ) : null}
          </span>
          {low ? (
            <span className={`shrink-0 text-[9.5px] font-black sm:text-[10px] ${(g.left ?? 0) <= GIFT_URGENT_LEFT ? "text-[#E53935]" : "text-[#B45309]"}`}>
              Còn {g.left}
              <span className="hidden sm:inline"> suất</span>
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-neutral-800" title={g.text}>
          {g.text}
        </div>
      </div>
    </div>
  );
}
