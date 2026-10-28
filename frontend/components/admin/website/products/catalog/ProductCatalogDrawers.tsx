"use client";

import React from "react";
import { Drawer, Modal } from "antd";
import { Check, HelpCircle } from "lucide-react";
import { FilterSearchSelect } from "@/components/admin/ui/FilterSearchSelect";
import { ShopCategorySelect } from "@/components/ShopCategorySelect";
import {
  VISIBLE_OPTIONS,
  fmtVnd,
  type AudienceType,
  type BadgeFilter,
  type Row,
} from "./catalogTypes";

export interface ProductCatalogDrawersProps {
  mobileFilterOpen: boolean;
  onCloseMobileFilter: () => void;
  activeFilterCount: number;
  selectedNhoms: string[];
  setSelectedNhoms: (paths: string[]) => void;
  visible: "all" | "1" | "0";
  setVisible: (val: "all" | "1" | "0") => void;
  badgeFilter: BadgeFilter;
  setBadgeFilter: (val: BadgeFilter) => void;
  badgeFilterOptions: { value: string; label: string }[];
  total: number;
  setPage: (p: number) => void;

  badgeTargetRow: Row | null;
  onCloseBadgeDrawer: () => void;
  badgeOptions: { value: string; label: string }[];
  onSaveMerch: (row: Row, patch: { webPin?: number; webBadge?: string }) => void;

  mobileGuideOpen: boolean;
  onCloseMobileGuide: () => void;
  audience: AudienceType;
}

export function ProductCatalogDrawers({
  mobileFilterOpen,
  onCloseMobileFilter,
  activeFilterCount,
  selectedNhoms,
  setSelectedNhoms,
  visible,
  setVisible,
  badgeFilter,
  setBadgeFilter,
  badgeFilterOptions,
  total,
  setPage,
  badgeTargetRow,
  onCloseBadgeDrawer,
  badgeOptions,
  onSaveMerch,
  mobileGuideOpen,
  onCloseMobileGuide,
  audience,
}: ProductCatalogDrawersProps) {
  return (
    <>
      {/* 1. BOTTOM SHEET BỘ LỌC TRÊN MOBILE (< md) */}
      <Drawer
        title={
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">Bộ lọc hàng hóa</span>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedNhoms([]);
                  setVisible("all");
                  setBadgeFilter("all");
                  setPage(1);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Đặt lại
              </button>
            ) : null}
          </div>
        }
        placement="bottom"
        onClose={onCloseMobileFilter}
        open={mobileFilterOpen}
        size="auto"
        className="rounded-t-2xl [&_.ant-drawer-header]:border-b-0 [&_.ant-drawer-header]:px-4 [&_.ant-drawer-header]:pt-4 [&_.ant-drawer-header]:pb-2 [&_.ant-drawer-body]:px-4 [&_.ant-drawer-body]:py-2"
        footer={
          <div className="p-3">
            <button
              type="button"
              onClick={onCloseMobileFilter}
              className="w-full h-10 rounded-xl bg-emerald-700 font-semibold text-white text-xs hover:bg-emerald-800 transition active:scale-[0.99]"
            >
              Xem {total.toLocaleString("vi-VN")} kết quả
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          {/* Nhóm hàng */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Nhóm hàng</label>
            <ShopCategorySelect
              value={selectedNhoms}
              placeholder="Tất cả nhóm hàng"
              showLabel={false}
              onChange={(paths) => {
                setPage(1);
                setSelectedNhoms(paths);
              }}
            />
          </div>

          {/* Trạng thái hiển thị */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Trạng thái hiển thị</label>
            <FilterSearchSelect
              value={visible === "all" ? "" : visible}
              allLabel="Tất cả trạng thái"
              placeholder="Tất cả trạng thái"
              options={VISIBLE_OPTIONS}
              onChange={(v) => {
                setPage(1);
                setVisible((v as "1" | "0") || "all");
              }}
            />
          </div>

          {/* Nhãn sản phẩm */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Nhãn sản phẩm</label>
            <FilterSearchSelect
              value={badgeFilter === "all" ? "" : badgeFilter}
              allLabel="Tất cả nhãn"
              placeholder="Tất cả nhãn"
              options={badgeFilterOptions}
              onChange={(v) => {
                setPage(1);
                setBadgeFilter((v as BadgeFilter) || "all");
              }}
            />
          </div>
        </div>
      </Drawer>

      {/* 2. BOTTOM SHEET CHỌN NHÃN SẢN PHẨM TRÊN MOBILE */}
      <Drawer
        title={
          <div className="flex items-start gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
              {badgeTargetRow?.anh ? (
                <img src={badgeTargetRow.anh} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-gray-900 truncate">
                {badgeTargetRow?.ten || "Chọn nhãn sản phẩm"}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                <span className="font-mono text-gray-600">{badgeTargetRow?.ma}</span>
                <span>·</span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  {fmtVnd(badgeTargetRow?.gia || 0)}
                </span>
              </div>
            </div>
          </div>
        }
        placement="bottom"
        open={Boolean(badgeTargetRow)}
        onClose={onCloseBadgeDrawer}
        size="auto"
        className="rounded-t-2xl [&_.ant-drawer-header]:border-b [&_.ant-drawer-header]:border-gray-100 [&_.ant-drawer-header]:px-4 [&_.ant-drawer-header]:py-3 [&_.ant-drawer-body]:px-4 [&_.ant-drawer-body]:py-3"
      >
        <div className="space-y-2 pb-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
            Chọn nhãn hiển thị:
          </p>
          <div className="space-y-1.5">
            {badgeOptions.map((opt) => {
              const isSelected = (badgeTargetRow?.webBadge || "") === opt.value;
              return (
                <button
                  key={opt.value || "auto"}
                  type="button"
                  onClick={() => {
                    if (!badgeTargetRow) return;
                    const webBadge = opt.value;
                    const patch: { webBadge: string; webPin?: number } = { webBadge };
                    if (!webBadge) patch.webPin = 0;
                    onSaveMerch({ ...badgeTargetRow, webBadge }, patch);
                    onCloseBadgeDrawer();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition active:scale-[0.99] cursor-pointer ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-2xs"
                      : "border-gray-200/80 bg-white hover:bg-gray-50 text-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                        !opt.value
                          ? "bg-gray-300"
                          : opt.value === "noi_bat"
                          ? "bg-amber-500"
                          : opt.value === "ban_chay_sap_het"
                          ? "bg-rose-500"
                          : opt.value === "giam_gia"
                          ? "bg-blue-500"
                          : opt.value === "dat_truoc"
                          ? "bg-purple-500"
                          : opt.value === "moi"
                          ? "bg-emerald-500"
                          : "bg-pink-500"
                      }`}
                    />
                    <span className="text-[13px]">{opt.label}</span>
                  </div>
                  {isSelected ? (
                    <Check size={16} className="text-emerald-700 shrink-0 font-bold" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </Drawer>

      {/* 3. MODAL HƯỚNG DẪN GHIM & NHÃN TRÊN MOBILE */}
      <Modal
        open={mobileGuideOpen}
        onCancel={onCloseMobileGuide}
        footer={null}
        centered
        title={
          <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            <span>Quy tắc ghim vị trí & gắn nhãn</span>
          </div>
        }
        className="[&_.ant-modal-content]:rounded-2xl"
      >
        <div className="space-y-3 leading-relaxed text-xs text-gray-700 pt-1">
          <div className="flex items-start gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">1</span>
            <p>
              <strong className="text-gray-900">Vị trí ghim:</strong> Số nhỏ hiển thị trước trong nhãn đang gắn. Trùng số cùng nhãn sẽ tự động thay thế SP cũ.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">2</span>
            <p>
              <strong className="text-gray-900">Mục «Sản phẩm mới»:</strong> Hệ thống tự động ưu tiên các SP được ghim nhãn <em>Mới</em>.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">3</span>
            <p>
              <strong className="text-gray-900">Khóa nhãn:</strong> SP đã gắn nhãn sẽ được cố định, không bị tự động ghi đè. Để đổi, chọn <em>«Chưa gắn»</em> rồi bấm <em>«Áp nhãn mặc định»</em>.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">4</span>
            <p>
              <strong className="text-gray-900">5 nhãn hỗ trợ:</strong> Nổi bật · Bán chạy và sắp hết · Giảm giá · Đặt trước · Mới.
            </p>
          </div>

          {audience !== "common" ? (
            <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-normal">
              <strong>Lưu ý danh sách sỉ:</strong> Chỉ áp dụng cho tài khoản sỉ HCM & sỉ tỉnh đã duyệt. Chỉnh ở danh sách này không thay đổi nhãn hay ghim của khách lẻ.
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
