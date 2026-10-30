"use client";

import Link from "next/link";
import { useShopMeQuery } from "@/lib/authQueries";
import { useCart } from "@/lib/cart";
import { formatVnd } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  RotateCw,
  Truck,
} from "lucide-react";

export type CartQuote = {
  subtotal: number;
  minimum: number;
  remaining: number;
  missing: string[];
  canCheckout: boolean;
  issues: Array<{ code: string; message: string }>;
};

export function useCartQuote(delivery?: {
  deliveryMethod: "giao_tan_noi" | "nhan_cua_hang";
  province: string;
  district?: string;
  ward?: string;
}) {
  const { data: user } = useShopMeQuery();
  const lines = useCart((s) => s.lines).filter((l) => l.selected);
  const isSi = user?.siStatus === "active" && user.roles.includes("si");
  const items = lines.map((l) => ({ productCode: l.ma, quantity: l.qty }));
  const quote = useQuery({
    queryKey: [
      "shop",
      "cart",
      "quote",
      user?.id,
      user?.siStatus,
      user?.siRegion,
      items,
      delivery,
    ],
    queryFn: () =>
      siRequest<CartQuote>("/api/shop/cart/quote", { items, ...delivery }),
    enabled: Boolean(isSi && items.length),
    refetchInterval: 15000,
  });
  return { isSi, items, quote };
}

export function SiCartNotice({ className = "" }: { className?: string }) {
  const { isSi, items, quote } = useCartQuote();
  if (!isSi || !items.length) return null;

  // Lỗi mạng hoặc server báo giá
  if (quote.error) {
    return (
      <aside
        id="wholesale-cart-notice"
        role="alert"
        className={`w-full scroll-mt-28 flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs sm:text-sm text-amber-900 shadow-2xs ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle size={16} className="text-amber-700 shrink-0" />
          <span className="truncate">{quote.error.message}</span>
        </div>
        <button
          type="button"
          onClick={() => void quote.refetch()}
          className="inline-flex items-center gap-1 shrink-0 rounded-md bg-amber-200/80 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300 transition cursor-pointer"
        >
          <RotateCw size={12} />
          <span>Thử lại</span>
        </button>
      </aside>
    );
  }

  // Đang kiểm tra điều kiện sỉ
  if (!quote.data) {
    return (
      <aside
        id="wholesale-cart-notice"
        role="status"
        className={`w-full scroll-mt-28 flex items-center gap-2 rounded-xl bg-emerald-50/50 border border-emerald-100 px-3.5 py-2 text-xs text-emerald-800 animate-pulse ${className}`}
      >
        <RotateCw size={13} className="animate-spin text-emerald-700" />
        <span>Đang kiểm tra điều kiện mua sỉ…</span>
      </aside>
    );
  }

  const { missing, subtotal: total, minimum, issues, canCheckout } = quote.data;
  const filteredIssues = issues?.filter((i) => i.code !== "minimum" && i.code !== "price") || [];

  // Trạng thái cần báo giá riêng
  if (missing.length > 0) {
    return (
      <aside
        id="wholesale-cart-notice"
        className={`w-full scroll-mt-28 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs sm:text-sm text-amber-950 shadow-2xs ${className}`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-700 shrink-0" />
          <span>
            Cần báo giá trước khi đặt: <strong className="font-semibold">{missing.join(", ")}</strong>
          </span>
        </div>
        <a
          href="https://zalo.me/0968989336"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-semibold text-amber-800 hover:text-amber-950 underline self-start sm:self-auto"
        >
          Liên hệ báo giá sỉ &rarr;
        </a>
      </aside>
    );
  }

  // Trạng thái chưa đủ mức tiền tối thiểu (kèm thanh tiến trình thanh thoát)
  if (minimum > 0 && total < minimum) {
    const remaining = minimum - total;
    const progressPercent = Math.min(100, Math.round((total / minimum) * 100));

    return (
      <aside
        id="wholesale-cart-notice"
        className={`w-full scroll-mt-28 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3.5 py-2.5 text-xs sm:text-[13px] text-amber-950 shadow-2xs space-y-2 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 shrink-0 rounded bg-amber-700 px-1.5 py-0.5 text-[10.5px] font-bold text-white uppercase tracking-wider">
              <Building2 size={11} />
              <span>Giá sỉ</span>
            </span>
            <span className="font-medium text-amber-950">
              Thêm <strong className="font-bold underline">{formatVnd(remaining)}</strong> để đạt mức tiền hàng sỉ tối thiểu ({formatVnd(minimum)})
            </span>
          </div>
          <Link
            href="/tim"
            className="inline-flex items-center gap-1 self-start sm:self-auto shrink-0 rounded-md bg-amber-800 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-900 transition active:scale-95"
          >
            <span>Mua thêm</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {/* Thanh tiến trình mini chuẩn Amazon / Shopee */}
        <div className="w-full bg-amber-200/70 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-amber-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {filteredIssues.length > 0 ? (
          <ul className="list-disc pl-5 text-[11.5px] text-amber-900 space-y-0.5 pt-0.5">
            {filteredIssues.map((issue, idx) => (
              <li key={idx}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </aside>
    );
  }

  // TRẠNG THÁI CHUẨN CÁC CÔNG TY LỚN (Đã áp dụng giá sỉ & Giỏ hàng hợp lệ - Chiều cao chỉ ~38px)
  return (
    <aside
      id="wholesale-cart-notice"
      className={`w-full scroll-mt-28 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-3.5 py-2 text-xs sm:text-[13px] text-emerald-950 shadow-2xs ${className}`}
    >
      {/* Vế trái: Badge sỉ VIP + Xác nhận giá sỉ đã áp dụng */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center gap-1 shrink-0 rounded bg-[#1C4C40] px-1.5 py-0.5 text-[10.5px] font-bold text-white uppercase tracking-wider">
          <Building2 size={11} />
          <span>Khách sỉ Aloha</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-900 truncate">
          <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
          <span>
            {canCheckout
              ? "Giá sỉ đã áp dụng • Giỏ hàng đủ điều kiện đặt hàng"
              : "Giá sỉ áp dụng theo tài khoản của bạn"}
          </span>
        </span>
      </div>

      {/* Vế phải: Ghi chú vận chuyển sỉ HCM thanh thoát */}
      <div className="flex items-center gap-1.5 text-emerald-800/80 text-[11px] sm:text-[11.5px] shrink-0 font-normal sm:pl-2">
        <Truck size={13} className="shrink-0 text-emerald-700" />
        <span>Sỉ HCM: Khách tự bố trí xe nhận tại cửa hàng/TP.HCM</span>
      </div>

      {filteredIssues.length > 0 ? (
        <div className="w-full pt-1 border-t border-emerald-200/60 text-amber-800 text-[11.5px]">
          <ul className="list-disc pl-4 space-y-0.5">
            {filteredIssues.map((issue, idx) => (
              <li key={idx}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
