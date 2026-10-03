import type { PromotionItem } from "../form/promotionFormModel";

const STATUS_CLASS = {
  active: "bg-emerald-50 text-[#2D5A27] border border-emerald-200/80 font-semibold",
  paused: "bg-[#fffbe6] text-[#faad14] border border-[#ffe58f]",
  other: "bg-slate-100 text-slate-600 border border-slate-200",
};

/** Nhãn trạng thái đợt phát hành. */
export function PromotionStatusText({
  status,
  draftLabel,
  inlineBlock,
}: {
  status: PromotionItem["status"];
  draftLabel: string;
  inlineBlock?: boolean;
}) {
  const cls = status === "active" ? STATUS_CLASS.active : status === "paused" ? STATUS_CLASS.paused : STATUS_CLASS.other;
  const label = status === "active" ? "Đang kích hoạt" : status === "paused" ? "Tạm dừng" : draftLabel;
  return (
    <span className={`${inlineBlock ? "inline-block " : ""}text-xs px-2.5 py-0.5 rounded font-medium ${cls}`}>
      {label}
    </span>
  );
}

const PILL = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";
const PILL_TONE = {
  green: { box: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  amber: { box: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
  gray: { box: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400" },
};

/** Nhãn tròn có chấm màu (trạng thái mã, lượt dùng). */
export function DotPill({ tone, children }: { tone: keyof typeof PILL_TONE; children: string }) {
  const t = PILL_TONE[tone];
  return (
    <span className={`${PILL} ${t.box}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}
