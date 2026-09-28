"use client";

import React from "react";
import { Layers, Percent, RotateCcw, Sliders } from "lucide-react";

export function ShopDefaultRateBanner({
  liveDefault,
  submittingBulk,
  stats,
  rateFilterTab,
  setRateFilterTab,
  setPage,
  onOpenShopDefaultModal,
  onOpenApplyAllModal,
  onResetAllToDefault,
}: {
  liveDefault: number | undefined;
  submittingBulk: boolean;
  stats: {
    totalProducts: number;
    defaultRateProducts: number;
    customRateProducts: number;
    excludedProducts: number;
  } | null;
  rateFilterTab: "all" | "default" | "custom" | "excluded";
  setRateFilterTab: React.Dispatch<React.SetStateAction<"all" | "default" | "custom" | "excluded">>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onOpenShopDefaultModal: () => void;
  onOpenApplyAllModal: () => void;
  onResetAllToDefault: () => void;
}) {
  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Percent size={20} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Tỷ lệ hoa hồng toàn shop (Shop-wide Default)
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                Chuẩn sàn TMĐT
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-emerald-800">
                {liveDefault ?? "—"}%
              </span>
              <span className="text-xs text-slate-500">
                áp dụng tự động cho mọi sản phẩm không cài đặt hoa hồng riêng lẻ
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 lg:pt-0">
          <button
            type="button"
            onClick={onOpenShopDefaultModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 hover:border-emerald-400"
          >
            <Sliders size={14} />
            Đổi % toàn shop
          </button>
          <button
            type="button"
            onClick={onOpenApplyAllModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
          >
            <Layers size={14} />
            Gán % cho TẤT CẢ sản phẩm
          </button>
          <button
            type="button"
            disabled={submittingBulk}
            onClick={onResetAllToDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            title="Đưa toàn bộ sản phẩm về tỷ lệ mặc định shop"
          >
            <RotateCcw size={13} />
            Về mặc định toàn bộ
          </button>
        </div>
      </div>

      {/* Thống kê phân bổ sản phẩm */}
      {stats ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-emerald-100/70 pt-3 text-xs">
          <span className="font-semibold text-slate-600">Phân bổ danh mục:</span>
          <button
            type="button"
            onClick={() => {
              setRateFilterTab("all");
              setPage(1);
            }}
            className={`rounded-md px-2 py-0.5 font-medium transition ${
              rateFilterTab === "all"
                ? "bg-emerald-700 text-white font-bold"
                : "bg-white text-slate-700 hover:bg-emerald-100/60"
            }`}
          >
            Tất cả: <b>{stats.totalProducts}</b> SP
          </button>
          <button
            type="button"
            onClick={() => {
              setRateFilterTab("default");
              setPage(1);
            }}
            className={`rounded-md px-2 py-0.5 font-medium transition ${
              rateFilterTab === "default"
                ? "bg-emerald-700 text-white font-bold"
                : "bg-white text-slate-700 hover:bg-emerald-100/60"
            }`}
          >
            Theo % mặc định ({liveDefault}%): <b>{stats.defaultRateProducts}</b> SP
          </button>
          <button
            type="button"
            onClick={() => {
              setRateFilterTab("custom");
              setPage(1);
            }}
            className={`rounded-md px-2 py-0.5 font-medium transition ${
              rateFilterTab === "custom"
                ? "bg-emerald-700 text-white font-bold"
                : "bg-white text-slate-700 hover:bg-emerald-100/60"
            }`}
          >
            Có % riêng: <b>{stats.customRateProducts}</b> SP
          </button>
          {stats.excludedProducts > 0 ? (
            <button
              type="button"
              onClick={() => {
                setRateFilterTab("excluded");
                setPage(1);
              }}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                rateFilterTab === "excluded"
                  ? "bg-rose-700 text-white font-bold"
                  : "bg-white text-slate-700 hover:bg-rose-50"
              }`}
            >
              Loại trừ (0%): <b>{stats.excludedProducts}</b> SP
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
