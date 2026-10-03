"use client";

import { useState } from "react";
import { InputNumber } from "antd";
import { Gift, Trash2 } from "lucide-react";
import {
  MAX_GIFTS_PER_PRODUCT,
  rowGifts,
  withGifts,
  type CampaignGiftAdmin,
  type CampaignProductAdmin,
  type ProductFacts,
} from "@/lib/campaign/campaignAdminApi";
import { ProductPicker } from "@/components/admin/website/shared/ProductPicker";

type Props = {
  row: CampaignProductAdmin;
  factsByMa: Record<string, ProductFacts>;
  locked: boolean;
  onChange: (row: CampaignProductAdmin) => void;
  onNeedFacts: (mas: string[]) => void;
};

function GiftLine({
  gift,
  facts,
  locked,
  onChange,
  onRemove,
}: {
  gift: CampaignGiftAdmin;
  facts?: ProductFacts;
  locked: boolean;
  onChange: (g: CampaignGiftAdmin) => void;
  onRemove: () => void;
}) {
  const short = facts != null && gift.quota > facts.stock;
  return (
    <li className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-2xs">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 font-bold text-slate-800">
        <span className="rounded border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 font-mono text-[#2D5A27]">{gift.ma}</span>
        <span className="truncate">{facts?.ten || ""}</span>
      </span>
      <label className="flex items-center gap-1.5 font-medium text-slate-500">
        Mỗi cây tặng:
        <InputNumber
          size="small"
          min={1}
          max={10}
          disabled={locked}
          value={gift.qty}
          onChange={(v) => onChange({ ...gift, qty: Number(v) || 1 })}
          suffix={<span className="text-[11px] text-slate-400">cái</span>}
          className="!w-20 font-bold"
        />
      </label>
      <label className="flex items-center gap-1.5 font-medium text-slate-500">
        Tổng quà:
        <InputNumber
          size="small"
          min={1}
          disabled={locked}
          value={gift.quota}
          onChange={(v) => onChange({ ...gift, quota: Number(v) || 1 })}
          suffix={<span className="text-[11px] text-slate-400">suất</span>}
          className="!w-24 font-bold"
        />
      </label>
      {facts ? (
        <span className={short ? "font-semibold text-amber-600" : "text-slate-400"}>
          (Tồn kho quà {gift.ma}: {facts.stock} cái{short ? " — ít hơn tổng quà" : ""})
        </span>
      ) : null}
      {!locked ? (
        <button
          type="button"
          className="ml-auto flex !h-7 !w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          onClick={onRemove}
          title="Bỏ quà này"
          aria-label={`Bỏ quà ${gift.ma}`}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </li>
  );
}

/** Tối đa 5 quà / SP; mỗi quà có số tặng mỗi cây và tổng suất riêng — quà nào hết thì quà khác vẫn tặng. */
export function GiftsEditor({ row, factsByMa, locked, onChange, onNeedFacts }: Props) {
  const gifts = rowGifts(row);
  const [note, setNote] = useState("");
  const full = gifts.length >= MAX_GIFTS_PER_PRODUCT;
  const setGifts = (next: CampaignGiftAdmin[]) => onChange(withGifts(row, next));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Gift size={14} className="text-amber-600" aria-hidden /> Quà tặng kèm
          {gifts.length ? (
            <span className="font-semibold text-slate-400">
              ({gifts.length}/{MAX_GIFTS_PER_PRODUCT})
            </span>
          ) : null}
        </span>
        {gifts.length > 1 ? (
          <span className="text-[11px] text-slate-500">Mỗi quà tính suất riêng; quà nào hết thì các quà còn lại vẫn được tặng.</span>
        ) : null}
      </div>
      {gifts.length ? (
        <ul className="space-y-1.5">
          {gifts.map((g, i) => (
            <GiftLine
              key={g.ma}
              gift={g}
              facts={factsByMa[g.ma]}
              locked={locked}
              onChange={(next) => setGifts(gifts.map((x, j) => (j === i ? next : x)))}
              onRemove={() => setGifts(gifts.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      ) : null}
      {!locked && !full ? (
        <div className="max-w-md">
          <ProductPicker
            placeholder={gifts.length ? "Thêm quà khác (gõ mã SKU hoặc tên)..." : "Chọn sản phẩm tặng kèm (gõ mã SKU hoặc tên)..."}
            onPick={(p) => {
              const ma = p.ma.toUpperCase();
              if (gifts.some((g) => g.ma === ma)) return setNote(`${ma} đã có trong danh sách quà.`);
              setNote("");
              onNeedFacts([ma]);
              setGifts([...gifts, { ma, qty: 1, quota: Math.max(1, row.quota) }]);
            }}
          />
        </div>
      ) : null}
      {full && !locked ? <p className="text-[11px] text-slate-500">Đã đủ {MAX_GIFTS_PER_PRODUCT} quà cho sản phẩm này.</p> : null}
      {note ? <p className="text-[11px] font-medium text-rose-600">{note}</p> : null}
    </div>
  );
}
