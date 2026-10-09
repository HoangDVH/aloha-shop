"use client";

import type { ReactNode } from "react";

export type TicketTone = "green" | "peach" | "cream" | "gray" | "red" | "bronze";

const STUB_BG: Record<TicketTone, string> = {
  green: "bg-[#0D9488] text-white",
  red: "bg-[#C8102E] text-white",
  bronze: "bg-[#C8102E] text-white",
  peach: "bg-[#C8102E] text-white",
  cream: "bg-[#C8102E] text-white",
  gray: "bg-slate-200 text-slate-500",
};

/** Cuống vé cỡ lớn (kho voucher trang chủ / trang ưu đãi): nền chuyển sắc cao cấp chuẩn TMĐT. */
const STUB_BG_LG: Record<TicketTone, string> = {
  green: "bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#115E59] text-white",
  red: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  bronze: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  peach: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  cream: "bg-gradient-to-br from-[#C8102E] via-[#E11D48] to-[#9F1239] text-white",
  gray: "bg-slate-200 text-slate-500",
};

const ACCENT: Record<TicketTone, string> = {
  green: "#0D9488",
  red: "#E11D48",
  bronze: "#E11D48",
  peach: "#E11D48",
  cream: "#E11D48",
  gray: "#CBD5E1",
};

type Props = {
  stubValue: string;
  tone: TicketTone;
  /** Icon hiển thị cùng nhãn trên badge (như xe tải, hộp quà, vé %...). */
  icon?: ReactNode;
  /** Chữ nhỏ phía trên giá trị (ví dụ "SHIP", "QUÀ TẶNG", "GIẢM"). */
  stubTopLabel?: string;
  /** Chữ nhỏ phía dưới giá trị (ví dụ "TỐI ĐA 100K"). */
  stubSubLabel?: string;
  title: string;
  /** Các dòng mô tả (điều kiện, hạn dùng, lượt còn...). */
  children?: ReactNode;
  /** Nút / trạng thái bên phải. */
  action?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  notchBg?: string;
  className?: string;
  badge?: ReactNode;
  /** "lg": cuống to, số lớn, viền màu trên thân vé. Mặc định "md" (giỏ hàng, ví, admin). */
  size?: "md" | "lg";
};

/** Vé voucher dạng coupon TMĐT chuẩn: cuống vé full chiều cao, vết cắt khuyết bán nguyệt (như Ảnh 1). */
export function VoucherTicket({
  stubValue,
  tone,
  icon,
  stubTopLabel,
  stubSubLabel,
  title,
  children,
  action,
  selected,
  disabled,
  notchBg = "var(--aloha-surface, #F8FAF8)",
  className = "",
  badge,
  size = "md",
}: Props) {
  const lg = size === "lg";
  const border = selected
    ? "border-2 border-[#165A36] ring-2 ring-[#165A36]/15 shadow-sm"
    : disabled
      ? "border-slate-200/60 opacity-80"
      : "border-slate-200/90 hover:border-slate-300 hover:shadow-md";
  const stubBg = disabled ? "bg-slate-200 text-slate-400" : (lg ? STUB_BG_LG : STUB_BG)[tone];
  const notch = lg ? "h-3.5 w-3.5 -right-1.5 sm:h-4 sm:w-4 sm:-right-2" : "h-3 w-3 -right-1.5";

  return (
    <div
      className={`relative flex items-stretch rounded-xl sm:rounded-2xl bg-white transition-all duration-200 shadow-2xs border ${border} ${
        lg ? "min-h-[76px] sm:min-h-[82px]" : "min-h-[70px] sm:min-h-[76px]"
      } ${className}`}
    >
      {/* 1. CUỐNG VÉ BÊN TRÁI (FULL HEIGHT, TỶ LỆ GỌN GÀNG CHUẨN TMĐT) */}
      <div
        className={`relative flex shrink-0 flex-col items-center justify-center rounded-l-xl sm:rounded-l-2xl text-center select-none overflow-hidden ${
          lg ? "w-[72px] sm:w-[78px] p-1 sm:p-1.5" : "w-[66px] sm:w-[72px] p-1"
        } ${stubBg}`}
      >
        {lg && !disabled ? (
          <span
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.22),transparent_55%)]"
            aria-hidden
          />
        ) : null}
        <div
          className={`relative flex items-center justify-center gap-0.5 font-black uppercase tracking-wider text-white/95 leading-tight ${
            lg ? "text-[9px] sm:text-[10px]" : "text-[8px] sm:text-[9px]"
          }`}
        >
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span>{stubTopLabel || "GIẢM"}</span>
        </div>
        <span
          className={`relative font-black tracking-tight leading-none text-white ${
            lg ? "mt-0.5 sm:mt-1 text-[18px] sm:text-[21px] drop-shadow-xs" : "mt-0.5 text-base sm:text-lg leading-tight"
          }`}
        >
          {stubValue}
        </span>
        {stubSubLabel ? (
          <span className="text-[7px] sm:text-[7.5px] font-bold uppercase tracking-tight text-white/80 mt-0.5">
            {stubSubLabel}
          </span>
        ) : null}

        {/* Vết cắt khuyết tròn trên đỉnh tại ranh giới cuống vé */}
        <span
          className={`absolute ${notch} ${lg ? "-top-1.5 sm:-top-2" : "-top-1.5"} rounded-full border border-slate-200/80 shadow-inner z-10`}
          style={{ backgroundColor: notchBg }}
          aria-hidden="true"
        />
        {/* Vết cắt khuyết tròn dưới đáy tại ranh giới cuống vé */}
        <span
          className={`absolute ${notch} ${lg ? "-bottom-1.5 sm:-bottom-2" : "-bottom-1.5"} rounded-full border border-slate-200/80 shadow-inner z-10`}
          style={{ backgroundColor: notchBg }}
          aria-hidden="true"
        />
        {/* Đường gân đứt nét phân cách cuống vé và thân vé */}
        <div
          className={`absolute right-0 w-0 border-r border-dashed border-white/35 z-10 ${lg ? "top-2 bottom-2 sm:top-2.5 bottom-2.5" : "top-1.5 bottom-1.5"}`}
        />
      </div>

      {/* 2. THÂN VÉ BÊN PHẢI (NỀN TRẮNG) */}
      <div
        className={`relative flex flex-1 items-center justify-between min-w-0 rounded-r-xl sm:rounded-r-2xl gap-2 h-full ${
          lg ? "py-1.5 px-2.5 sm:py-2 sm:pl-3 sm:pr-2.5" : "p-2 sm:p-2.5"
        }`}
      >
        {lg ? (
          <span
            className="pointer-events-none absolute left-2 right-3 top-0 h-[2px] rounded-b-full"
            style={{ backgroundColor: disabled ? ACCENT.gray : ACCENT[tone] }}
            aria-hidden
          />
        ) : null}
        <div className={`flex-1 min-w-0 flex flex-col justify-center ${lg ? "space-y-0.5" : "space-y-0.5"}`}>
          <div className="flex items-start gap-1.5 min-w-0">
            <h4
              className={`font-bold leading-snug line-clamp-1 break-words ${lg ? "text-[12px] sm:text-[13px]" : "text-[11.5px] sm:text-[12px]"} ${
                disabled ? "text-slate-500" : "text-slate-900"
              }`}
              title={title}
            >
              {title}
            </h4>
            {badge}
          </div>
          {children}
        </div>

        {/* 3. NÚT HÀNH ĐỘNG BÊN PHẢI */}
        {action ? (
          <div className="flex flex-col items-end gap-1 shrink-0">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Một dòng mô tả trên vé: icon + chữ. */
export function TicketLine({
  icon,
  children,
  muted,
}: {
  icon: ReactNode;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${muted ? "text-slate-400" : "text-slate-500"}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
