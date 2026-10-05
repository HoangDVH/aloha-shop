"use client";

import { useState } from "react";
import { Collapse, Input } from "antd";
import { Image as ImageIcon, Palette, BellRing, Settings2, ChevronDown, ChevronUp, ChevronRight, Flame, Zap } from "lucide-react";
import type { CampaignBannerUI } from "@/lib/campaign/campaignApi";
import type { CampaignContentAdmin, FieldError } from "@/lib/campaign/campaignAdminApi";
import { FLASH_STAGE_BG, FLASH_STAGE_DEFAULT, flashStageText } from "@/lib/campaign/flashSlots";
import { CAMPAIGN_PALETTES, matchPalette } from "@/lib/campaign/campaignPalettes";
import { fieldErrorsFor } from "../wizardModel";
import { CampaignBannerField } from "./CampaignBannerField";

type Props = {
  content: CampaignContentAdmin;
  update: (fn: (c: CampaignContentAdmin) => CampaignContentAdmin) => void;
  errors: FieldError[];
};

type Display = CampaignContentAdmin["display"];

const SLOTS: { id: string; kind: "main" | "side"; label: string; badge?: string }[] = [
  { id: "main-1", kind: "main", label: "Banner chính", badge: "Slide 1 trang chủ" },
  { id: "side-1", kind: "side", label: "Banner phụ 1", badge: "Cạnh banner chính" },
  { id: "side-2", kind: "side", label: "Banner phụ 2", badge: "Cạnh banner chính" },
];

function setBanner(
  banners: CampaignBannerUI[],
  id: string,
  kind: "main" | "side",
  patch: Partial<CampaignBannerUI>
): CampaignBannerUI[] {
  const cur = banners.find((b) => b.id === id) || { id, kind, imageUrl: "", href: "/uu-dai" };
  const next = { ...cur, ...patch };
  const rest = banners.filter((b) => b.id !== id);
  if (!next.imageUrl) return rest;
  return kind === "main" ? [next, ...rest] : [...rest, next];
}

function BannerSlot({
  slot,
  display,
  setDisplay,
}: {
  slot: (typeof SLOTS)[number];
  display: Display;
  setDisplay: (p: Partial<Display>) => void;
}) {
  const b = display.banners.find((x) => x.id === slot.id);
  const set = (patch: Partial<CampaignBannerUI>) =>
    setDisplay({ banners: setBanner(display.banners, slot.id, slot.kind, patch) });

  return (
    <div className="space-y-2 p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">{slot.label}</span>
        {slot.badge ? (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            {slot.badge}
          </span>
        ) : null}
      </div>
      <CampaignBannerField
        value={b?.imageUrl}
        aspect={slot.kind === "main" ? 8 / 3 : 2}
        ratioLabel={slot.kind === "main" ? "8:3" : "2:1"}
        onChange={(url) => set({ imageUrl: url })}
      />
      {slot.kind === "main" && b ? (
        <div className="pt-1">
          <div className="text-[11px] text-slate-500 font-medium mb-1">Ảnh riêng cho Mobile (tuỳ chọn):</div>
          <CampaignBannerField
            value={b.mobileImageUrl}
            aspect={2}
            ratioLabel="2:1"
            onChange={(url) => set({ mobileImageUrl: url || undefined })}
          />
        </div>
      ) : null}
      {b ? (
        <Input
          addonBefore={<span className="text-xs text-slate-500">Liên kết</span>}
          value={b.href}
          onChange={(e) => set({ href: e.target.value })}
          placeholder="/uu-dai"
          className="!h-9 !rounded-lg text-xs"
        />
      ) : null}
    </div>
  );
}

function ColorSection({
  display,
  setDisplay,
}: {
  display: Display;
  setDisplay: (p: Partial<Display>) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const colors = display.colors;
  const active = matchPalette(colors)?.key;

  const color = (k: keyof Display["colors"], label: string) => (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
      <input
        type="color"
        value={colors[k]}
        onChange={(e) => setDisplay({ colors: { ...colors, [k]: e.target.value } })}
        className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      {/* 4 Bảng màu gợi ý */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {CAMPAIGN_PALETTES.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            onClick={() => setDisplay({ colors: { ...p.colors } })}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
              active === p.key
                ? "border-emerald-600 ring-2 ring-emerald-100 bg-emerald-50/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-emerald-400"
            }`}
          >
            <span className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-black/10" aria-hidden>
              <span className="h-7 w-3.5" style={{ background: p.colors.primary }} />
              <span className="h-7 w-3.5" style={{ background: p.colors.accent }} />
              <span className="h-7 w-3.5" style={{ background: p.colors.cream }} />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold text-slate-800">{p.label}</span>
              <span className="block truncate text-[10px] text-slate-400">{p.hint}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Xem trước & Tùy chỉnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs font-semibold text-[#2D5A27] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Tùy chỉnh mã màu riêng</span>
          {showCustom ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          {color("primary", "Màu chính (Header & Nút)")}
          {color("accent", "Màu nhấn (Nổi bật)")}
          {color("cream", "Màu nền (Background)")}
        </div>
      )}

      {/* Hộp xem trước màu */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-2xs" aria-label="Xem trước màu">
        <div
          className="truncate px-3 py-1.5 text-center text-xs font-bold text-white"
          style={{ background: colors.primary }}
        >
          {display.announcement.text || "Dòng thông báo sự kiện trên cùng website"}
        </div>
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-600"
          style={{ background: colors.cream }}
        >
          <span>Nền khối voucher và trang ưu đãi</span>
          <span
            className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}
          >
            Đầu trang ưu đãi
          </span>
        </div>
      </div>
    </div>
  );
}

function FlashStageFields({
  content,
  display,
  setDisplay,
  errors,
}: {
  content: CampaignContentAdmin;
  display: Display;
  setDisplay: (p: Partial<Display>) => void;
  errors: FieldError[];
}) {
  const stage = display.flashStage || FLASH_STAGE_DEFAULT;
  const set = (patch: Partial<typeof stage>) => setDisplay({ flashStage: { ...stage, ...patch } });
  const shown = flashStageText(display.flashStage);
  const hasSlots = content.slots.length > 0;

  return (
    <div className="space-y-3 pt-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Tiêu đề dải Flash Sale</label>
          <Input
            value={stage.title}
            maxLength={60}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={FLASH_STAGE_DEFAULT.title}
            className="!h-9 !rounded-lg text-xs"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Trang chủ + trang Ưu đãi (tab Flash Sale) trên máy tính. Điện thoại luôn hiện gọn &quot;Flash Sale&quot;.
          </p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Nhãn nổi bật (Huy hiệu)</label>
          <Input
            value={stage.badge}
            maxLength={24}
            onChange={(e) => set({ badge: e.target.value })}
            placeholder={FLASH_STAGE_DEFAULT.badge}
            className="!h-9 !rounded-lg text-xs"
          />
          <p className="mt-1 text-[11px] text-slate-400">Ô vàng cạnh tiêu đề, chỉ hiện trên máy tính. Để trống thì ẩn.</p>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Dòng mô tả phụ</label>
        <Input
          value={stage.subtitle}
          maxLength={140}
          onChange={(e) => set({ subtitle: e.target.value })}
          placeholder={FLASH_STAGE_DEFAULT.subtitle}
          className="!h-9 !rounded-lg text-xs"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Chỉ hiện dưới tiêu đề ở trang Ưu đãi → tab Flash Sale (máy tính). Dải trang chủ không hiện dòng này.
        </p>
      </div>

      {/* Xem trước: giống dải Flash Sale trang chủ */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-500">
          Xem trước trang chủ{hasSlots ? " (đồng hồ chỉ hiện khi đang trong khung giờ mở bán)" : ""}
        </div>
        <FlashStagePreview title={shown.title} badge={shown.badge} countdown={hasSlots} />
        <div className="max-w-[360px]">
          <FlashStagePreview title="Flash Sale" countdown={hasSlots} compact />
        </div>
      </div>
    </div>
  );
}

function FlashStagePreview({
  title,
  badge,
  countdown,
  compact = false,
}: {
  title: string;
  badge?: string;
  countdown: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-white shadow-2xs"
      style={{ background: FLASH_STAGE_BG }}
      aria-label={compact ? "Xem trước trên điện thoại" : "Xem trước trên máy tính"}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white">
          <Zap className="h-4 w-4 fill-[#CE2D37] text-[#CE2D37]" aria-hidden />
        </span>
        <span className="truncate text-[13px] font-black uppercase tracking-wide">{title}</span>
        {badge ? (
          <span className="shrink-0 rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-black uppercase text-[#92400E]">
            {badge}
          </span>
        ) : null}
        {countdown ? (
          <span className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-[11px] font-black tabular-nums">
            <Flame size={12} className="fill-[#FFD54F] text-[#FFD54F]" aria-hidden />
            <span className="rounded bg-black/40 px-1 leading-tight">01</span>:
            <span className="rounded bg-black/40 px-1 leading-tight">24</span>:
            <span className="rounded bg-black/40 px-1 leading-tight">38</span>
          </span>
        ) : null}
      </div>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-white/95">
        Xem tất cả <ChevronRight size={14} aria-hidden />
      </span>
    </div>
  );
}

export function DisplayStep({ content, update, errors }: Props) {
  const display = content.display;
  const setDisplay = (patch: Partial<Display>) =>
    update((c) => ({ ...c, display: { ...c.display, ...patch } }));
  const bannerErrors = fieldErrorsFor(errors, "display.banners");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Card 1: 3 Ảnh Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            <ImageIcon size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">3 ảnh banner trang chủ</h3>
            <p className="text-xs text-slate-500">Hiển thị nổi bật ở khu vực đầu trang chủ khi chiến dịch diễn ra</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {SLOTS.map((s) => (
            <BannerSlot key={s.id} slot={s} display={display} setDisplay={setDisplay} />
          ))}
        </div>
        {bannerErrors.map((m) => (
          <div key={m} className="text-xs font-medium text-rose-600">{m}</div>
        ))}
      </div>

      {/* Card 2: Màu sắc chiến dịch */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            <Palette size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Màu sắc chủ đạo</h3>
            <p className="text-xs text-slate-500">Áp dụng cho thanh thông báo, nút voucher và nền trang sự kiện</p>
          </div>
        </div>

        <ColorSection display={display} setDisplay={setDisplay} />
      </div>

      {/* Card 3: Thông điệp & Dải thông báo */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            <BellRing size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Dải thông báo</h3>
            <p className="text-xs text-slate-500">Thông báo chữ chạy trên thanh topbar</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Nội dung thông báo trên cùng (Topbar)
            </label>
            <Input
              value={display.announcement.text}
              maxLength={140}
              placeholder="Ví dụ: Đại lễ 2/9 - Giảm giá đến 50%, số lượng có hạn!"
              onChange={(e) => setDisplay({ announcement: { ...display.announcement, text: e.target.value } })}
              className="!h-9 !rounded-lg text-xs"
            />
          </div>
        </div>
      </div>

      {/* Card 4: Tuỳ chỉnh nâng cao (Gập gọn trong Accordion) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <Collapse
          ghost
          items={[
            {
              key: "adv",
              label: (
                <div className="flex items-center gap-2 py-1 text-slate-800 font-bold text-sm">
                  <Settings2 size={16} className="text-slate-500" />
                  <span>Tuỳ chỉnh nâng cao: Dải Flash Sale, Tiêu đề lớn trang ưu đãi, Nút Header</span>
                </div>
              ),
              children: (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <FlashStageFields content={content} display={display} setDisplay={setDisplay} errors={errors} />

                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Chữ lớn đầu trang ưu đãi</label>
                      <Input
                        value={display.hero.title}
                        maxLength={120}
                        onChange={(e) => setDisplay({ hero: { ...display.hero, title: e.target.value } })}
                        className="!h-9 !rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Dòng mô tả đầu trang</label>
                      <Input
                        value={display.hero.subtitle}
                        maxLength={240}
                        onChange={(e) => setDisplay({ hero: { ...display.hero, subtitle: e.target.value } })}
                        className="!h-9 !rounded-lg text-xs"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Chỉ hiện trên banner khi chưa có ảnh banner chính; luôn dùng làm mô tả khi chia sẻ link.
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">Hạn đặt để giao kịp (dải dưới banner trang ưu đãi)</label>
                      <Input
                        value={display.hero.deadline || ""}
                        maxLength={120}
                        placeholder="Ví dụ: Đặt trước 18/10 để giao kịp 20/10 (nội thành TP.HCM). Để trống thì ẩn."
                        onChange={(e) => setDisplay({ hero: { ...display.hero, deadline: e.target.value } })}
                        className="!h-9 !rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Chữ trên nút Header</label>
                    <Input
                      value={display.headerPill.text}
                      maxLength={40}
                      placeholder="Ví dụ: Voucher 50K"
                      onChange={(e) => setDisplay({ headerPill: { ...display.headerPill, text: e.target.value } })}
                      className="!h-9 !rounded-lg text-xs max-w-xs"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Điện thoại tự bỏ chữ &quot;Voucher&quot; ở đầu cho gọn (ví dụ &quot;Voucher 50K&quot; → &quot;50K&quot;).
                    </p>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
