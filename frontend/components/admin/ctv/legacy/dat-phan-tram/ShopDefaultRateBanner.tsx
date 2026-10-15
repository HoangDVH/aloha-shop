"use client";

import React from "react";
import { Dropdown, Tooltip, type MenuProps } from "antd";
import { ChevronDown, HelpCircle, Layers, Percent, RotateCcw, Sliders } from "lucide-react";

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
  const bulkMenuItems: MenuProps["items"] = [
    {
      key: "apply_all",
      label: (
        <span className="flex items-center gap-2 py-0.5 text-xs font-medium text-slate-700">
          <Layers size={14} className="text-emerald-700" />
          <span>Gán % cho TẤT CẢ sản phẩm</span>
        </span>
      ),
      onClick: onOpenApplyAllModal,
    },
    {
      type: "divider",
    },
    {
      key: "reset_all",
      label: (
        <span className="flex items-center gap-2 py-0.5 text-xs font-medium text-rose-600">
          <RotateCcw size={14} />
          <span>Khôi phục toàn bộ về mặc định ({liveDefault ?? 0}%)</span>
        </span>
      ),
      disabled: submittingBulk,
      onClick: onResetAllToDefault,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Tỷ lệ mặc định toàn shop + Nút đổi */}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            <Percent size={13} strokeWidth={2.6} />
          </span>
          <span className="text-xs text-slate-500">Hoa hồng mặc định:</span>
          <span className="text-sm font-black text-emerald-800">{liveDefault ?? "—"}%</span>
          <Tooltip
            title="Tỷ lệ áp dụng tự động cho các sản phẩm không có cài đặt hoa hồng riêng."
            placement="top"
          >
            <HelpCircle size={13} className="cursor-help text-slate-400 hover:text-slate-600" />
          </Tooltip>
          <button
            type="button"
            onClick={onOpenShopDefaultModal}
            className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-50 hover:border-emerald-400"
          >
            <Sliders size={11} />
            Đổi %
          </button>
        </div>

        {/* Right: Phân loại theo tab & Menu thao tác hàng loạt */}
        <div className="flex flex-wrap items-center gap-2">
          {stats ? (
            <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRateFilterTab("all");
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  rateFilterTab === "all"
                    ? "bg-white font-bold text-emerald-800 shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả <span className="opacity-75 font-normal">({stats.totalProducts})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRateFilterTab("default");
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  rateFilterTab === "default"
                    ? "bg-white font-bold text-emerald-800 shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900"
                }`}
              >
                Mặc định ({liveDefault ?? 0}%) <span className="opacity-75 font-normal">({stats.defaultRateProducts})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRateFilterTab("custom");
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  rateFilterTab === "custom"
                    ? "bg-white font-bold text-emerald-800 shadow-xs"
                    : "font-medium text-slate-600 hover:text-slate-900"
                }`}
              >
                Có % riêng <span className="opacity-75 font-normal">({stats.customRateProducts})</span>
              </button>
              {stats.excludedProducts > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setRateFilterTab("excluded");
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${
                    rateFilterTab === "excluded"
                      ? "bg-white font-bold text-rose-700 shadow-xs"
                      : "font-medium text-slate-600 hover:text-rose-700"
                  }`}
                >
                  Loại trừ (0%) <span className="opacity-75 font-normal">({stats.excludedProducts})</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <Dropdown menu={{ items: bulkMenuItems }} trigger={["click"]}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300"
            >
              <span>Tác vụ hàng loạt</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
