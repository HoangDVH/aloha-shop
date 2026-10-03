"use client";

import { useState } from "react";
import { Input, Switch, App } from "antd";
import { Clock, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from "lucide-react";
import type { CampaignSlotUI, FieldError } from "@/lib/campaign/campaignAdminApi";
import { SLOT_TEMPLATES, slotRangeText, type SlotTemplate } from "@/lib/campaign/flashSlots";
import { fieldErrorsFor } from "../wizardModel";

type Props = {
  slots: CampaignSlotUI[];
  locked: boolean;
  errors: FieldError[];
  /** Số SP đang gắn từng mã khung — để báo trước khi xoá / thay khung. */
  usage: Record<string, number>;
  /** `removed` = mã khung bị bỏ; SP đang gắn các khung đó chuyển về "Cả ngày". */
  onChange: (slots: CampaignSlotUI[], removed: string[]) => void;
};

const nextKey = (slots: CampaignSlotUI[]) => {
  for (let h = 9; h < 24; h++) {
    const key = `S${h}`;
    if (!slots.some((s) => s.key === key)) return key;
  }
  for (let n = 1; ; n++) if (!slots.some((s) => s.key === `K${n}`)) return `K${n}`;
};

export function SlotsEditor({ slots, locked, errors, usage, onChange }: Props) {
  const { modal } = App.useApp();
  const [collapsed, setCollapsed] = useState(slots.length > 0);

  const set = (i: number, patch: Partial<CampaignSlotUI>) =>
    onChange(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)), []);

  const confirmRemoval = (removed: string[], apply: () => void, title: string) => {
    const n = removed.reduce((sum, k) => sum + (usage[k] || 0), 0);
    if (!n) return apply();
    modal.confirm({
      title,
      content: `${n} sản phẩm đang gắn khung bị bỏ sẽ chuyển về "Cả ngày (toàn chiến dịch)".`,
      okText: "Đồng ý",
      cancelText: "Huỷ",
      onOk: apply,
    });
  };

  const applyTemplate = (t: SlotTemplate) => {
    const keep = new Set(t.slots.map((s) => s.key));
    const removed = slots.map((s) => s.key).filter((k) => !keep.has(k));
    const labels = new Map(slots.map((s) => [s.key, s.label]));
    const next = t.slots.map((s) => (labels.get(s.key) ? { ...s, label: labels.get(s.key) } : s));
    confirmRemoval(removed, () => {
      onChange(next, removed);
      setCollapsed(false);
    }, `Áp dụng mẫu "${t.label}"?`);
  };

  const removeAllSlots = () => {
    if (!slots.length) return;
    const removed = slots.map((s) => s.key);
    confirmRemoval(removed, () => {
      onChange([], removed);
    }, "Chuyển về bán giá sale cả ngày (bỏ tất cả khung giờ)?");
  };

  const isAllDay = slots.length === 0;

  return (
    <div className="space-y-3.5">
      {/* Chọn chế độ: Cả ngày hay Chia khung giờ */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                if (!isAllDay) removeAllSlots();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isAllDay
                  ? "bg-[#2D5A27] text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              ✓ Bán giá sale cả ngày (Toàn chiến dịch)
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                if (isAllDay) applyTemplate(SLOT_TEMPLATES[0]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isAllDay
                  ? "bg-[#2D5A27] text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              ⚡ Chia theo khung giờ Flash Sale {!isAllDay ? `(${slots.length} khung)` : ""}
            </button>
          </div>
        </div>

        {!isAllDay && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              {collapsed ? (
                <>
                  <span>Mở rộng chi tiết ({slots.length})</span>
                  <ChevronDown size={14} />
                </>
              ) : (
                <>
                  <span>Thu gọn khung giờ</span>
                  <ChevronUp size={14} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Trường hợp 1: Bán cả ngày (Mặc định gọn gàng) */}
      {isAllDay && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 font-medium">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          <span>
            Tất cả sản phẩm sale áp dụng xuyên suốt chiến dịch. Khi có sản phẩm Flash Sale theo từng khung giờ cụ thể, hãy chọn &quot;Chia theo khung giờ Flash Sale&quot;.
          </span>
        </div>
      )}

      {/* Trường hợp 2: Có khung giờ */}
      {!isAllDay && (
        <div className="space-y-3">
          {/* Mẫu nhanh & Tóm tắt khi thu gọn */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Sparkles size={13} className="text-amber-500" /> Mẫu nhanh:
              </span>
              {SLOT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={locked}
                  title={t.hint}
                  onClick={() => applyTemplate(t)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-600 hover:text-[#2D5A27] transition-all cursor-pointer shadow-2xs"
                >
                  {t.label}
                </button>
              ))}
            </div>
            {!locked && (
              <button
                type="button"
                onClick={removeAllSlots}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                Xóa tất cả khung
              </button>
            )}
          </div>

          {/* Dải xem nhanh các khung khi thu gọn */}
          {collapsed ? (
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-700">Các khung giờ đang chạy:</span>
                <span className="text-[11px] text-slate-500 font-medium">Bấm &quot;Mở rộng chi tiết&quot; để sửa giờ hoặc nhãn</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <span className="text-emerald-700 font-mono text-[11px]">{s.key}</span>
                    <span>{slotRangeText(s)}</span>
                    {s.label ? <span className="text-slate-500 font-normal">· {s.label}</span> : null}
                    {usage[s.key] ? (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        {usage[s.key]} sp
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Bảng chi tiết khung giờ */
            <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="hidden sm:grid sm:grid-cols-[40px_1fr_1.2fr_90px_90px_40px] items-center gap-2.5 px-3 py-1.5 bg-slate-100/80 rounded-lg text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Mã</span>
                <span>Khung giờ</span>
                <span>Nhãn nổi bật (tuỳ chọn)</span>
                <span>Qua đêm</span>
                <span className="text-center">Số SP</span>
                <span className="text-right">Xoá</span>
              </div>

              {slots.map((s, i) => {
                const err = fieldErrorsFor(errors, `slots.${i}`)[0];
                const used = usage[s.key] || 0;
                return (
                  <div
                    key={s.key}
                    className="flex flex-col sm:grid sm:grid-cols-[40px_1fr_1.2fr_90px_90px_40px] items-start sm:items-center gap-2 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors"
                  >
                    <span className="font-mono text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-center w-8">
                      {s.key}
                    </span>
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <Input
                        type="time"
                        className="!w-24 text-center font-bold !h-9 !rounded-lg text-xs"
                        value={s.start}
                        disabled={locked}
                        onChange={(e) => set(i, { start: e.target.value })}
                      />
                      <span className="text-slate-400 font-bold">–</span>
                      <Input
                        type="time"
                        className="!w-24 text-center font-bold !h-9 !rounded-lg text-xs"
                        value={s.end}
                        disabled={locked}
                        onChange={(e) => set(i, { end: e.target.value })}
                      />
                    </div>
                    <Input
                      className="w-full !h-9 !rounded-lg text-xs"
                      maxLength={20}
                      value={s.label || ""}
                      disabled={locked}
                      placeholder="Nhãn: Hỗ trợ ship 30K, Giảm 50%..."
                      onChange={(e) => set(i, { label: e.target.value || undefined })}
                    />
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                      <Switch
                        size="small"
                        checked={!!s.overnight}
                        disabled={locked}
                        onChange={(v) => set(i, { overnight: v || undefined })}
                      />
                      <span className="sm:hidden text-slate-500">Qua nửa đêm</span>
                    </label>
                    <span className="text-xs text-slate-600 font-medium text-center">
                      {used ? <b className="text-emerald-700">{used} sp</b> : <span className="text-slate-400">0 sp</span>}
                    </span>
                    <div className="text-right w-full sm:w-auto">
                      {!locked && (
                        <button
                          type="button"
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          onClick={() =>
                            confirmRemoval(
                              [s.key],
                              () => onChange(slots.filter((_, j) => j !== i), [s.key]),
                              `Xoá khung ${s.start}–${s.end}?`
                            )
                          }
                          aria-label={`Xoá khung ${s.start}–${s.end}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    {err ? <div className="sm:col-span-6 text-xs font-medium text-rose-600">{err}</div> : null}
                  </div>
                );
              })}

              {!locked && slots.length < 8 ? (
                <div className="pt-2">
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 !h-9 text-xs font-bold text-[#2D5A27] transition-all hover:bg-emerald-100"
                    onClick={() => {
                      const key = nextKey(slots);
                      const h = Math.min(Number(key.slice(1)) || 20, 22);
                      const hh = String(h).padStart(2, "0");
                      onChange([...slots, { key, start: `${hh}:00`, end: `${String(h + 1).padStart(2, "0")}:00` }], []);
                    }}
                  >
                    <Plus size={14} /> Thêm khung giờ Flash Sale
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
