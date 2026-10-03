"use client";

import { useState } from "react";
import { InputNumber, Select, Switch, Tooltip } from "antd";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { rowGifts, type CampaignProductAdmin, type CampaignSlotUI, type ProductFacts } from "@/lib/campaign/campaignAdminApi";
import { slotOptions, slotRangeText } from "@/lib/campaign/flashSlots";
import { percentOff, rowError, saleFromPercent, vnd, withPriceInput } from "../wizardModel";
import { GiftsEditor } from "./GiftsEditor";

const PRICE_TIP = "Thấp hơn giá web = giá sale. Cao hơn giá web = giá trước KM (chỉ hiện gạch ngang, khách vẫn trả giá web).";

type Props = {
  id: string;
  row: CampaignProductAdmin;
  facts?: ProductFacts;
  factsByMa: Record<string, ProductFacts>;
  slots: CampaignSlotUI[];
  locked: boolean;
  serverErrors: string[];
  onChange: (row: CampaignProductAdmin) => void;
  onRemove: () => void;
  onNeedFacts: (mas: string[]) => void;
};

function Profit({ sale, cost }: { sale: number; cost: number }) {
  if (!(sale > 0) || !(cost > 0)) return <span className="text-slate-400 font-medium text-xs">—</span>;
  const left = sale - cost;
  return (
    <div className="flex flex-col items-center">
      <span
        className={`inline-flex items-center justify-center px-2.5 !h-8 rounded-lg text-xs font-bold ${
          left < 0
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
        }`}
      >
        {left < 0 ? "-" : "+"}{vnd(Math.abs(left))}
      </span>
      {left < 0 ? (
        <span className="text-[10px] font-semibold text-rose-600 mt-0.5">Bán dưới vốn</span>
      ) : null}
    </div>
  );
}

function SlotTag({ row, slots }: { row: CampaignProductAdmin; slots: CampaignSlotUI[] }) {
  if (!row.slotKey) return null;
  const s = slots.find((x) => x.key === row.slotKey);
  return <span className="font-semibold text-[#C8102E]"> · ⚡ {s ? slotRangeText(s) : `Khung ${row.slotKey} (đã xoá)`}</span>;
}

/** Tồn kho của chính SP (đã trừ hàng đang giữ cho đơn); số lượng sale vượt tồn thì cảnh báo ngay trên dòng. */
function StockText({ row, facts }: { row: CampaignProductAdmin; facts?: ProductFacts }) {
  const stock = facts?.stock;
  const short = stock != null && row.salePrice > 0 && row.quota > stock;
  return (
    <Tooltip title={short ? "Hết tồn thì khách chỉ đặt được nếu SP cho phép đặt trước; nên giảm số lượng sale hoặc nhập thêm hàng." : undefined}>
      <span>
        Tồn kho SP: <b className={short ? "text-amber-600" : "text-slate-700"}>{stock ?? "?"}</b>
        {short ? <span className="font-semibold text-amber-600"> (ít hơn {row.quota} suất sale)</span> : null}
      </span>
    </Tooltip>
  );
}

function GiftTag({ row }: { row: CampaignProductAdmin }) {
  const n = rowGifts(row).length;
  if (!n) return null;
  return <span className="text-emerald-700 font-semibold"> · 🎁 {n > 1 ? `${n} quà` : "Có quà"}</span>;
}

function RowOptions(props: Props) {
  const { row, slots, locked, onChange } = props;
  return (
    <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 md:grid-cols-3 rounded-b-xl">
      <label className="text-xs font-semibold text-slate-700">
        Khung giờ Flash Sale
        <Select
          size="small"
          className="mt-1.5 w-full font-medium"
          disabled={locked}
          value={row.slotKey || ""}
          onChange={(v) => onChange({ ...row, slotKey: v || undefined })}
          options={slotOptions(slots)}
        />
        <span className="mt-1 block text-[11px] font-normal text-slate-500">
          Ngoài khung giờ khách vẫn đặt được, tính giá thường.
        </span>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Giới hạn mỗi khách mua
        <InputNumber
          size="small"
          className="mt-1.5 !w-full font-semibold"
          min={1}
          max={99}
          disabled={locked}
          value={row.perCustomerLimit}
          onChange={(v) => onChange({ ...row, perCustomerLimit: Number(v) || 1 })}
          suffix={<span className="text-xs text-slate-400">sản phẩm</span>}
        />
        <span className="mt-1 block text-[11px] font-normal text-slate-500">
          Số suất và giới hạn tính lại từ đầu cho mỗi khung giờ, mỗi ngày.
        </span>
      </label>
      <div className="flex flex-col justify-end gap-2 text-xs font-semibold text-slate-700 pb-0.5">
        <span className="flex items-center gap-2">
          <Switch
            size="small"
            checked={!!row.dealHot}
            onChange={(v) => onChange({ ...row, dealHot: v || undefined })}
            disabled={locked}
          />
          <span>Ghim ở &quot;Deal Hot&quot;</span>
        </span>
        <span className="flex items-center gap-2">
          <Switch
            size="small"
            checked={!!row.paused}
            onChange={(v) => onChange({ ...row, paused: v || undefined })}
            disabled={locked}
          />
          <span className={row.paused ? "text-amber-600 font-bold" : ""}>
            Tạm dừng bán giá sale SP này
          </span>
        </span>
      </div>
      <div className="md:col-span-3 pt-2 border-t border-slate-200/60">
        <GiftsEditor {...props} />
      </div>
    </div>
  );
}

export function ProductRow(props: Props) {
  const { id, row, facts, locked, serverErrors, onChange, onRemove } = props;
  const [open, setOpen] = useState(false);
  const sortable = useSortable({ id, disabled: locked });
  const list = facts?.listPrice || 0;
  const anchor = row.compareAtPrice || 0;
  const priceValue = row.salePrice || anchor;
  const paidPrice = row.salePrice > 0 ? row.salePrice : anchor ? list : 0;
  const pctValue = anchor ? percentOff(anchor, list) : percentOff(list, row.salePrice);
  const setPrice = (v: unknown) => onChange(withPriceInput(row, Number(v) || 0, list));
  const anchorHint = anchor ? (
    <span className="mt-0.5 block text-[10px] font-semibold leading-tight text-amber-700">
      Giá gạch · khách trả {vnd(list)}
    </span>
  ) : null;
  const err = rowError(row, facts) || serverErrors[0];
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`rounded-xl border bg-white shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs ${
        err ? "border-rose-300 ring-1 ring-rose-200 bg-rose-50/20" : "border-slate-200"
      }`}
    >
      {/* Desktop view */}
      <div className="hidden md:grid md:grid-cols-[28px_minmax(180px,1.8fr)_140px_90px_100px_130px_70px] items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="cursor-grab text-slate-300 hover:text-slate-600 transition flex items-center justify-center !h-9 !w-7"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label="Kéo để đổi thứ tự"
        >
          <GripVertical size={16} />
        </button>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-900">
            <span className="font-mono text-emerald-800 bg-emerald-50/90 border border-emerald-200/90 px-1.5 py-0.5 rounded text-[11px] font-bold mr-1.5">
              {row.ma}
            </span>
            {facts?.ten || row.ma}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Giá niêm yết: <b className="text-slate-700">{vnd(list)}</b> · <StockText row={row} facts={facts} />
            <SlotTag row={row} slots={props.slots} />
            <GiftTag row={row} />
          </div>
        </div>
        <div>
          <Tooltip title={locked ? "Chỉ quản lý được sửa" : PRICE_TIP}>
            <InputNumber
              min={0}
              step={1000}
              disabled={locked}
              value={priceValue}
              onChange={setPrice}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(v) => Number(String(v).replace(/\D/g, ""))}
              suffix={<span className="text-xs font-bold text-slate-400 select-none">₫</span>}
              placeholder="0 ₫"
              className={`!w-full font-bold !h-9 !rounded-lg text-right [&_.ant-input-number-input]:!h-[34px] [&_.ant-input-number-input]:!text-xs ${
                anchor ? "text-slate-500 [&_.ant-input-number-input]:line-through" : "text-slate-900"
              }`}
            />
          </Tooltip>
          {anchorHint}
        </div>
        <Tooltip title={anchor ? "Mức giảm hiển thị so với giá trước KM" : "Mức giảm theo %"}>
          <InputNumber
            min={0}
            max={99}
            disabled={locked || !list || anchor > 0}
            value={pctValue}
            onChange={(v) => onChange({ ...row, salePrice: saleFromPercent(list, Number(v) || 0), compareAtPrice: undefined })}
            suffix={<span className="text-xs font-bold text-slate-400 select-none">%</span>}
            placeholder="0%"
            className="!w-full font-bold text-slate-900 !h-9 !rounded-lg text-center [&_.ant-input-number-input]:!h-[34px] [&_.ant-input-number-input]:!text-xs"
          />
        </Tooltip>
        <Tooltip title="Số lượng bán giá ưu đãi cho mỗi khung giờ, mỗi ngày">
          <InputNumber
            min={0}
            disabled={locked}
            value={row.quota}
            onChange={(v) => onChange({ ...row, quota: Number(v) || 0 })}
            suffix={<span className="text-xs font-semibold text-slate-400 select-none">sp</span>}
            placeholder="0"
            className="!w-full font-bold text-slate-900 !h-9 !rounded-lg text-center [&_.ant-input-number-input]:!h-[34px] [&_.ant-input-number-input]:!text-xs"
          />
        </Tooltip>
        <div className="flex items-center justify-center !h-9">
          <Profit sale={paidPrice} cost={facts?.cost || 0} />
        </div>
        <div className="flex items-center justify-center gap-1.5 !h-9">
          <button
            type="button"
            className={`flex items-center justify-center !h-9 !w-9 rounded-lg border transition-colors ${
              open
                ? "bg-emerald-50 border-emerald-200 text-[#2D5A27]"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
            onClick={() => setOpen((o) => !o)}
            title="Cài đặt quà tặng & khung giờ"
            aria-label="Tuỳ chọn thêm"
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {!locked ? (
            <button
              type="button"
              className="flex items-center justify-center !h-9 !w-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              onClick={onRemove}
              title="Xoá khỏi danh sách"
              aria-label="Xoá dòng"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Mobile view */}
      <div className="block md:hidden p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <button
              type="button"
              className="cursor-grab text-slate-400 hover:text-slate-600 mt-0.5 shrink-0"
              {...sortable.attributes}
              {...sortable.listeners}
              aria-label="Kéo để đổi thứ tự"
            >
              <GripVertical size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-emerald-800 bg-emerald-50/90 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] font-bold">
                  {row.ma}
                </span>
                <span className="text-xs font-bold text-slate-900 line-clamp-1">{facts?.ten || row.ma}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Giá niêm yết: <b className="text-slate-700">{vnd(list)}</b> · <StockText row={row} facts={facts} />
                <SlotTag row={row} slots={props.slots} />
                <GiftTag row={row} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className={`rounded-lg p-1.5 transition-colors ${open ? "bg-emerald-50 text-[#2D5A27]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}
              onClick={() => setOpen((o) => !o)}
              aria-label="Tuỳ chọn thêm"
            >
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {!locked ? (
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                onClick={onRemove}
                aria-label="Xoá dòng"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-100">
          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Giá sale / giá trước KM (₫)</div>
            <InputNumber
              size="small"
              min={0}
              step={1000}
              disabled={locked}
              value={priceValue}
              onChange={setPrice}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(v) => Number(String(v).replace(/\D/g, ""))}
              suffix={<span className="text-xs font-bold text-slate-400 select-none">₫</span>}
              placeholder="0 ₫"
              className={`!w-full font-bold !h-9 text-right ${anchor ? "text-slate-500 [&_.ant-input-number-input]:line-through" : "text-slate-900"}`}
            />
            {anchorHint}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Mức giảm (%)</div>
            <InputNumber
              size="small"
              min={0}
              max={99}
              disabled={locked || !list || anchor > 0}
              value={pctValue}
              onChange={(v) => onChange({ ...row, salePrice: saleFromPercent(list, Number(v) || 0), compareAtPrice: undefined })}
              suffix={<span className="text-xs font-bold text-slate-400 select-none">%</span>}
              placeholder="0%"
              className="!w-full font-bold text-slate-900 !h-9 text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 items-center bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1">Số lượng bán sale</div>
            <InputNumber
              size="small"
              min={0}
              disabled={locked}
              value={row.quota}
              onChange={(v) => onChange({ ...row, quota: Number(v) || 0 })}
              suffix={<span className="text-xs font-semibold text-slate-400 select-none">sp</span>}
              placeholder="0"
              className="!w-full font-bold text-slate-900 !h-9 text-center"
            />
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Lãi dự kiến</div>
            <Profit sale={paidPrice} cost={facts?.cost || 0} />
          </div>
        </div>
      </div>

      {err ? <div className="px-4 pb-2.5 text-xs font-medium text-rose-600">{err}</div> : null}
      {open ? <RowOptions {...props} /> : null}
    </div>
  );
}
