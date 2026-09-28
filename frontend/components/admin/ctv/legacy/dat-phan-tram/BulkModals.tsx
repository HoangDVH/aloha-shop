"use client";

import React from "react";
import { Layers, Sliders, X } from "lucide-react";

export function BulkModals({
  showShopDefaultModal,
  setShowShopDefaultModal,
  newShopRate,
  setNewShopRate,
  shopRateApplyMode,
  setShopRateApplyMode,
  submittingBulk,
  handleSaveShopDefault,
  showApplyAllModal,
  setShowApplyAllModal,
  allProductsRate,
  setAllProductsRate,
  handleApplyAllProducts,
}: {
  showShopDefaultModal: boolean;
  setShowShopDefaultModal: (v: boolean) => void;
  newShopRate: string;
  setNewShopRate: (v: string) => void;
  shopRateApplyMode: "unconfigured_only" | "overwrite_all";
  setShopRateApplyMode: (v: "unconfigured_only" | "overwrite_all") => void;
  submittingBulk: boolean;
  handleSaveShopDefault: () => Promise<void> | void;
  showApplyAllModal: boolean;
  setShowApplyAllModal: (v: boolean) => void;
  allProductsRate: string;
  setAllProductsRate: (v: string) => void;
  handleApplyAllProducts: () => Promise<void> | void;
}) {
  return (
    <>
      {/* MODAL 1: Cấu hình tỷ lệ hoa hồng toàn shop (Shop-wide Default Rate) */}
      {showShopDefaultModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Sliders size={18} />
                </div>
                <div className="font-bold text-slate-800">Đổi tỷ lệ hoa hồng toàn shop</div>
              </div>
              <button
                type="button"
                onClick={() => setShowShopDefaultModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600">
                  Tỷ lệ hoa hồng toàn shop mới (%)
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={newShopRate}
                    onChange={(e) => setNewShopRate(e.target.value)}
                    placeholder="VD: 5"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-3 pr-8 text-base font-bold text-emerald-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    %
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Mức % này sẽ là tỷ lệ hoa hồng cơ bản cho tất cả đơn hàng CTV khi mua các sản phẩm thông thường.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Phạm vi áp dụng (Chuẩn sàn Shopee / TikTok Shop):
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="shopRateApplyMode"
                      value="unconfigured_only"
                      checked={shopRateApplyMode === "unconfigured_only"}
                      onChange={() => setShopRateApplyMode("unconfigured_only")}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Chỉ áp dụng cho các sản phẩm chưa cài % riêng (Khuyên dùng)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Giữ nguyên các sản phẩm đã được ưu đãi hoặc điều chỉnh hoa hồng đặc biệt trước đây.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/40 p-3 hover:bg-amber-50 cursor-pointer">
                    <input
                      type="radio"
                      name="shopRateApplyMode"
                      value="overwrite_all"
                      checked={shopRateApplyMode === "overwrite_all"}
                      onChange={() => setShopRateApplyMode("overwrite_all")}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-amber-900">
                        Đồng bộ toàn bộ sản phẩm về mức mới này
                      </div>
                      <div className="text-[11px] text-amber-700">
                        Xóa tất cả % riêng lẻ của từng sản phẩm, đưa 100% sản phẩm trong shop về đúng mức % này.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowShopDefaultModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submittingBulk}
                onClick={() => void handleSaveShopDefault()}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
              >
                {submittingBulk ? "Đang áp dụng…" : "Lưu & Áp dụng"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL 2: Gán cứng % cho TẤT CẢ sản phẩm trong shop */}
      {showApplyAllModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                  <Layers size={18} />
                </div>
                <div className="font-bold text-slate-800">Gán % cho toàn bộ sản phẩm</div>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyAllModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-xs text-teal-900 leading-relaxed">
                Thao tác này sẽ đặt <b>cố định</b> % hoa hồng cho <b>toàn bộ sản phẩm</b> hiện có trong shop.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">
                  Tỷ lệ hoa hồng áp dụng (%)
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={allProductsRate}
                    onChange={(e) => setAllProductsRate(e.target.value)}
                    placeholder="VD: 10"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-3 pr-8 text-base font-bold text-teal-800 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowApplyAllModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submittingBulk}
                onClick={() => void handleApplyAllProducts()}
                className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-800 disabled:opacity-50"
              >
                {submittingBulk ? "Đang gán…" : "Xác nhận gán toàn bộ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
