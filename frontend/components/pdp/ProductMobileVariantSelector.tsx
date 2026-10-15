"use client";

import { LayoutGrid, ChevronRight } from "lucide-react";
import type { ShopVariantAxis } from "@/lib/api";

export interface ProductMobileVariantSelectorProps {
  axes: ShopVariantAxis[];
  selectedLabel: string;
  thumbnails: string[];
  needPick: boolean;
  qty: number;
  unit?: string;
  onClick: () => void;
}

export function ProductMobileVariantSelector({
  axes,
  selectedLabel,
  thumbnails,
  needPick,
  qty,
  unit,
  onClick,
}: ProductMobileVariantSelectorProps) {
  const axisNames = axes.map((a) => a.name).join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={needPick ? `Chọn phân loại: ${axisNames}` : `Đã chọn: ${selectedLabel}`}
      className="-mx-4 sm:-mx-5 flex w-full items-center justify-between gap-2 sm:gap-2.5 border-y border-[#eee] bg-white px-4 sm:px-5 py-3 text-left transition active:bg-stone-50 cursor-pointer select-none"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
        {/* Biểu tượng 4 ô vuông chuẩn phân loại TikTok Shop */}
        <LayoutGrid size={17} strokeWidth={2.2} className="shrink-0 text-stone-800" aria-hidden />

        {/* Danh sách ảnh biến thể thu nhỏ */}
        {thumbnails.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 overflow-hidden">
            {thumbnails.slice(0, 6).map((img, idx) => (
              <div
                key={idx}
                className={`relative h-7 w-7 shrink-0 overflow-hidden rounded-[4px] border border-stone-200/90 bg-stone-50 flex items-center justify-center ${
                  idx >= 4 ? "hidden min-[370px]:flex" : ""
                } ${
                  idx >= 5 ? "hidden min-[400px]:flex" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Dòng chữ trạng thái đã chọn / chọn phân loại chuẩn TikTok Shop */}
        <div className="min-w-0 flex-1 truncate text-xs sm:text-[13px] text-stone-600">
          {needPick ? (
            <>
              <span className="font-semibold text-stone-800">Chọn: </span>
              <span className="text-stone-600">
                {axisNames || "Phân loại hàng"}
              </span>
            </>
          ) : (
            <>
              <span>Đã chọn: </span>
              <span className="font-semibold text-stone-900">
                【{selectedLabel || "Mặc định"}】
              </span>
              {qty > 0 ? (
                <span className="text-stone-600">
                  {" "}{qty} {unit || "sản phẩm"}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Mũi tên chuyển hướng */}
      <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-stone-400 ml-1" aria-hidden />
    </button>
  );
}

export function ProductMobileVariantSkeleton() {
  return (
    <div className="-mx-4 sm:-mx-5 flex w-full items-center justify-between gap-2.5 border-y border-[#eee] bg-white px-4 sm:px-5 py-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-stone-200" />
        <div className="flex items-center gap-1">
          <div className="h-7 w-7 rounded-[4px] bg-stone-200" />
          <div className="h-7 w-7 rounded-[4px] bg-stone-200" />
          <div className="h-7 w-7 rounded-[4px] bg-stone-200" />
        </div>
      </div>
      <div className="h-3.5 w-24 rounded bg-stone-200" />
      <div className="h-4 w-4 rounded bg-stone-200" />
    </div>
  );
}
