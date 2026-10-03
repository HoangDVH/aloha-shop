"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Input, InputNumber, Switch } from "antd";
import { Globe, Edit3 } from "lucide-react";
import type { CampaignContentAdmin, FieldError } from "@/lib/campaign/campaignAdminApi";
import { fieldErrorsFor } from "../wizardModel";
import { LockedNote } from "./StepBits";
import { AlohaDateRangePicker } from "../../AlohaDateRangePicker";

type Props = {
  content: CampaignContentAdmin;
  update: (fn: (c: CampaignContentAdmin) => CampaignContentAdmin) => void;
  locked: boolean;
  errors: FieldError[];
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function WhenStep({ content, update, locked, errors }: Props) {
  const info = content.info;
  const setInfo = (patch: Partial<CampaignContentAdmin["info"]>) =>
    update((c) => ({ ...c, info: { ...c.info, ...patch } }));
  const range = [info.startAt ? dayjs(info.startAt) : null, info.endAt ? dayjs(info.endAt) : null] as const;

  const [editingSlug, setEditingSlug] = useState(false);
  const nameErrors = fieldErrorsFor(errors, "info.name");
  const slugErrors = fieldErrorsFor(errors, "info.slug");
  const timeErrors = [...fieldErrorsFor(errors, "info.startAt"), ...fieldErrorsFor(errors, "info.endAt")];

  const handleNameChange = (val: string) => {
    const next: Partial<CampaignContentAdmin["info"]> = { name: val };
    if (!editingSlug) {
      next.slug = slugify(val);
    }
    setInfo(next);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {locked ? <LockedNote /> : null}

      {/* Card 1: Thông tin cơ bản */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Thông tin chương trình</h3>
            <p className="text-xs text-slate-500">Tên hiển thị trên banner trang chủ, thanh thông báo và đường dẫn web</p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                Tên chiến dịch <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">{(info.name || "").length}/80</span>
            </div>
            <Input
              value={info.name}
              maxLength={80}
              disabled={locked}
              placeholder="Ví dụ: Đại lễ 2/9, Siêu sale Black Friday, Mừng 20/10..."
              onChange={(e) => handleNameChange(e.target.value)}
              className="!h-10 !rounded-xl font-medium text-slate-800 text-sm shadow-2xs"
            />
            {nameErrors.length ? (
              <p className="text-xs font-medium text-rose-600 mt-1.5">{nameErrors[0]}</p>
            ) : null}
          </div>

          {/* Đường dẫn Slug - Tinh gọn chuẩn sàn TMĐT */}
          <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3">
            {!editingSlug ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <Globe size={14} className="text-emerald-700 shrink-0" />
                  <span>Đường dẫn trang sự kiện:</span>
                  <span className="font-mono font-bold text-slate-800">
                    alohashop.vn/uu-dai/{info.slug || "duong-dan-trang"}
                  </span>
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => setEditingSlug(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D5A27] hover:underline cursor-pointer"
                  >
                    <Edit3 size={12} /> Tùy chỉnh URL
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Tùy chỉnh đường dẫn tĩnh (URL Slug):</span>
                  <button
                    type="button"
                    onClick={() => setEditingSlug(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Xong
                  </button>
                </div>
                <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-[#2D5A27] focus-within:ring-1 focus-within:ring-[#2D5A27]">
                  <span className="px-3 py-1.5 text-xs font-mono font-medium text-slate-400 bg-slate-50 border-r border-slate-200 select-none">
                    alohashop.vn/uu-dai/
                  </span>
                  <input
                    type="text"
                    value={info.slug}
                    maxLength={60}
                    disabled={locked}
                    onChange={(e) => setInfo({ slug: slugify(e.target.value) })}
                    placeholder="mung-20-10"
                    className="w-full bg-transparent px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            )}
            {slugErrors.length ? (
              <p className="text-xs font-medium text-rose-600 mt-1">{slugErrors[0]}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Card 2: Thời gian & Lịch trình hiệu lực */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Thời gian hiệu lực</h3>
            <p className="text-xs text-slate-500">Mức giá sale và ưu đãi sẽ tự động kích hoạt và kết thúc theo lịch này</p>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Khoảng thời gian chạy chiến dịch <span className="text-rose-500">*</span>
            </label>
            <AlohaDateRangePicker
              showTime
              disabled={locked}
              value={range as any}
              onChange={(v) =>
                setInfo({
                  startAt: v?.[0] ? v[0].toISOString() : "",
                  endAt: v?.[1] ? v[1].toISOString() : "",
                })
              }
              placeholder={["Bắt đầu (ngày giờ)", "Kết thúc (ngày giờ)"]}
              className="w-full"
            />
            {timeErrors.length ? (
              <p className="text-xs font-medium text-rose-600 mt-1.5">{timeErrors[0]}</p>
            ) : null}
          </div>

          {/* Teaser hé lộ trước */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <div>
              <div className="text-xs font-bold text-slate-800">Xem trước &amp; Đếm ngược (Teaser hé lộ)</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hiển thị huy hiệu sắp diễn ra kèm đồng hồ đếm ngược trên web trước giờ mở bán
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <InputNumber
                min={0}
                max={14}
                disabled={locked}
                value={info.teaserDays}
                onChange={(v) => setInfo({ teaserDays: Number(v) || 0 })}
                className="!w-24 !h-9 !rounded-lg font-bold text-center [&_.ant-input-number-input]:!h-[34px]"
              />
              <span className="text-xs font-medium text-slate-600">ngày trước sự kiện</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Chế độ kiểm thử (Test Mode) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Chạy thử cho tài khoản kiểm thử</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  info.testOnly
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-[#2D5A27] border border-emerald-200"
                }`}
              >
                {info.testOnly ? "Chế độ Test riêng tư" : "Chế độ Công khai"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {info.testOnly
                ? "Chỉ tài khoản admin/test mới nhìn thấy giá sale và banner trên web. Khách thật vẫn thấy giá thường."
                : "Tất cả khách hàng vào website sẽ thấy banner và mua được giá sale khi đến giờ."}
            </p>
          </div>
          <Switch
            checked={info.testOnly}
            disabled={locked}
            onChange={(v) => setInfo({ testOnly: v })}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
