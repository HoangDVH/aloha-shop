"use client";

import { useEffect, useMemo, useState } from "react";
import { Checkbox, Input, Spin, Switch, App } from "antd";
import { Search, Ticket, CheckCircle2 } from "lucide-react";
import type { CampaignContentAdmin, FieldError } from "@/lib/campaign/campaignAdminApi";
import type { PromotionItem } from "@/components/admin/promotions/form/promotionFormModel";
import { VoucherTicket } from "@/components/voucher/VoucherTicket";
import { voucherConditionText, voucherHeadline } from "@/lib/voucherFormat";
import { fieldErrorsFor } from "../wizardModel";
import { LockedNote } from "./StepBits";

type Props = {
  content: CampaignContentAdmin;
  update: (fn: (c: CampaignContentAdmin) => CampaignContentAdmin) => void;
  locked: boolean;
  errors: FieldError[];
};

type FilterTab = "all" | "selected" | "goods" | "shipping";

/** Lý do voucher không gắn được vào chiến dịch; null = dùng được. */
function blockReason(v: PromotionItem, nowMs: number): string | null {
  if (v.status === "paused") return "Tạm dừng";
  if (v.status === "draft") return "Bản nháp";
  if (v.status !== "active") return "Không hoạt động";
  if (v.endDate && Date.parse(v.endDate) <= nowMs) return "Đã hết hạn";
  if (v.targetCustomer === "wholesale") return "Chỉ cho khách sỉ";
  return null;
}

async function patchClaim(v: PromotionItem, claimRequired: boolean): Promise<PromotionItem> {
  const res = await fetch(`/api/shop/admin/promotions/${encodeURIComponent(v.id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimRequired, revision: v.revision }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Không lưu được");
  return data.item || { ...v, claimRequired, revision: (v.revision || 0) + 1 };
}

function VoucherCard({
  v,
  checked,
  locked,
  blocked,
  onToggle,
  onClaimChange,
}: {
  v: PromotionItem;
  checked: boolean;
  locked: boolean;
  blocked: string | null;
  onToggle: () => void;
  onClaimChange: (on: boolean) => void;
}) {
  const ship = v.benefitType === "shipping";
  const title = v.name || v.title;
  const customerTitle = v.title && v.title !== title ? v.title : "";
  return (
    <VoucherTicket
      stubValue={voucherHeadline(v)}
      tone={ship ? "cream" : "green"}
      title={title}
      selected={checked}
      disabled={!!blocked && !checked}
      notchBg="#fff"
      badge={
        blocked ? (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              checked ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            }`}
          >
            {blocked}
          </span>
        ) : null
      }
      action={<Checkbox checked={checked} disabled={locked || (!!blocked && !checked)} onChange={onToggle} />}
    >
      {customerTitle ? (
        <div className="truncate text-[11px] font-medium text-slate-400" title={customerTitle}>
          Khách thấy: {customerTitle}
        </div>
      ) : null}
      <div className="text-[11px] text-slate-500">{voucherConditionText(v)}</div>
      {blocked ? (
        <div className={`text-[11px] font-medium ${checked ? "text-rose-600" : "text-amber-700"}`}>
          {checked
            ? "Đang gắn nhưng khách không dùng được, nên bỏ chọn"
            : "Bật lại ở tab Đợt phát hành voucher để chọn được"}
        </div>
      ) : null}
      {!ship ? (
        <div className="text-[11px] text-slate-500">
          {v.combineWithShip !== false ? "Dùng chung với hỗ trợ ship" : "Không dùng chung với hỗ trợ ship"}
        </div>
      ) : null}
      {checked ? (
        <label className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
          <Switch size="small" checked={!!v.claimRequired} disabled={locked} onChange={onClaimChange} />
          <span>Khách phải bấm Lưu mã</span>
        </label>
      ) : null}
    </VoucherTicket>
  );
}

export function VouchersStep({ content, update, locked, errors }: Props) {
  const { message } = App.useApp();
  const [items, setItems] = useState<PromotionItem[] | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void fetch("/api/shop/admin/promotions?limit=100", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, []);

  const nowMs = Date.now();
  const selected = useMemo(() => new Set(content.voucherIds), [content.voucherIds]);

  const blockedOf = useMemo(
    () => new Map((items || []).map((v) => [v.id, blockReason(v, nowMs)])),
    [items, nowMs]
  );
  const list = useMemo(
    () =>
      [...(items || [])].sort(
        (a, b) => Number(!!blockedOf.get(a.id)) - Number(!!blockedOf.get(b.id))
      ),
    [items, blockedOf]
  );
  const usableList = useMemo(() => list.filter((v) => !blockedOf.get(v.id)), [list, blockedOf]);

  const toggle = (id: string) =>
    update((c) => ({
      ...c,
      voucherIds: c.voucherIds.includes(id)
        ? c.voucherIds.filter((x) => x !== id)
        : [...c.voucherIds, id],
    }));

  const selectAll = () => {
    const allUsableIds = usableList.map((v) => v.id);
    update((c) => ({
      ...c,
      voucherIds: Array.from(new Set([...c.voucherIds, ...allUsableIds])),
    }));
  };

  const deselectAll = () => {
    update((c) => ({ ...c, voucherIds: [] }));
  };

  const setClaim = async (v: PromotionItem, on: boolean) => {
    try {
      const saved = await patchClaim(v, on);
      setItems((all) => (all || []).map((x) => (x.id === v.id ? { ...x, ...saved } : x)));
    } catch (e: any) {
      message.error(e?.message || "Không lưu được");
    }
  };

  const displayedList = useMemo(() => {
    const q = search.toLowerCase().trim();
    return list.filter((v) => {
      if (tab === "selected" && !selected.has(v.id)) return false;
      if (tab === "goods" && v.benefitType === "shipping") return false;
      if (tab === "shipping" && v.benefitType !== "shipping") return false;
      if (q) {
        const name = `${v.title || ""} ${v.name || ""}`.toLowerCase();
        const id = (v.id || "").toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [list, tab, search, selected]);

  const selectedCount = selected.size;
  const goodsCount = list.filter((v) => v.benefitType !== "shipping").length;
  const shipCount = list.filter((v) => v.benefitType === "shipping").length;
  const errs = fieldErrorsFor(errors, "voucherIds");

  return (
    <div className="space-y-5 max-w-5xl">
      {locked ? <LockedNote /> : null}

      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
              <Ticket size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Voucher tặng khách hàng</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#2D5A27] border border-emerald-200">
                  Đã chọn {selectedCount} voucher
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Các voucher này sẽ hiển thị ở Kho Voucher của sự kiện để khách hàng lưu và sử dụng
              </p>
            </div>
          </div>

          {!locked && list.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-semibold text-[#2D5A27] hover:underline px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Bỏ chọn hết
              </button>
            </div>
          )}
        </div>

        {errs.length ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errs.join(" ")}
          </div>
        ) : null}

        {/* Thanh tìm kiếm & Tabs lọc voucher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                tab === "all"
                  ? "bg-[#2D5A27] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Tất cả ({list.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("selected")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                tab === "selected"
                  ? "bg-[#2D5A27] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Đã chọn ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => setTab("goods")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                tab === "goods"
                  ? "bg-[#2D5A27] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Giảm tiền hàng ({goodsCount})
            </button>
            <button
              type="button"
              onClick={() => setTab("shipping")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                tab === "shipping"
                  ? "bg-[#2D5A27] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Hỗ trợ ship ({shipCount})
            </button>
          </div>

          {/* Ô tìm kiếm */}
          <div className="w-full sm:w-64">
            <Input
              prefix={<Search size={13} className="text-slate-400" />}
              placeholder="Tìm tên, mã voucher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              className="!h-8 !rounded-lg text-xs bg-white"
            />
          </div>
        </div>

        {/* Nội dung danh sách voucher */}
        {items === null ? (
          <div className="py-12 text-center"><Spin /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">
              Chưa có voucher nào đang kích hoạt cho khách hàng lẻ. Bạn có thể tạo voucher mới ở tab &quot;Đợt phát hành voucher&quot;.
            </p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Không tìm thấy voucher nào khớp với bộ lọc.
          </div>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-2 pt-1">
            {displayedList.map((v) => (
              <VoucherCard
                key={v.id}
                v={v}
                checked={selected.has(v.id)}
                locked={locked}
                blocked={blockedOf.get(v.id) ?? null}
                onToggle={() => toggle(v.id)}
                onClaimChange={(on) => void setClaim(v, on)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
