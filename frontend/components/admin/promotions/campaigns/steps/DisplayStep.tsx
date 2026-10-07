"use client";

import { useState, type ReactNode } from "react";
import { Collapse, Input } from "antd";
import {
  Image as ImageIcon,
  Palette,
  BellRing,
  Settings2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import type { CampaignBannerUI } from "@/lib/campaign/campaignApi";
import type { CampaignContentAdmin, FieldError } from "@/lib/campaign/campaignAdminApi";
import { FLASH_STAGE_DEFAULT } from "@/lib/campaign/flashSlots";
import { CAMPAIGN_PALETTES, matchPalette } from "@/lib/campaign/campaignPalettes";
import { fieldErrorsFor } from "../wizardModel";
import { CampaignBannerField } from "./CampaignBannerField";

type Props = {
  content: CampaignContentAdmin;
  update: (fn: (c: CampaignContentAdmin) => CampaignContentAdmin) => void;
  errors: FieldError[];
};

type Display = CampaignContentAdmin["display"];

/** Backend nhận tối đa 12 banner; chừa 2 ô banner phụ. */
const MAX_MAIN = 10;

const SIDE_SLOTS = [
  { id: "side-1", label: "Banner phụ 1" },
  { id: "side-2", label: "Banner phụ 2" },
];

const isMain = (b: CampaignBannerUI) => b.kind === "main";
const newMainId = () => `main-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Banner chính luôn đứng trước banner phụ; thứ tự banner chính là thứ tự slide trang Ưu đãi. */
function upsertBanner(
  banners: CampaignBannerUI[],
  id: string,
  kind: "main" | "side",
  patch: Partial<CampaignBannerUI>
): CampaignBannerUI[] {
  const cur = banners.find((b) => b.id === id);
  const next = { ...(cur || { id, kind, imageUrl: "", href: "/uu-dai" }), ...patch };
  if (!next.imageUrl) return banners.filter((b) => b.id !== id);
  if (cur) return banners.map((b) => (b.id === id ? next : b));
  const mains = banners.filter(isMain);
  const sides = banners.filter((b) => !isMain(b));
  return kind === "main" ? [...mains, next, ...sides] : [...mains, ...sides, next];
}

function moveMain(banners: CampaignBannerUI[], id: string, dir: -1 | 1): CampaignBannerUI[] {
  const mains = banners.filter(isMain);
  const i = mains.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= mains.length) return banners;
  [mains[i], mains[j]] = [mains[j], mains[i]];
  return [...mains, ...banners.filter((b) => !isMain(b))];
}

function BannerCard({
  id,
  kind,
  label,
  badge,
  tools,
  banners,
  onBanners,
}: {
  id: string;
  kind: "main" | "side";
  label: string;
  badge?: string;
  tools?: ReactNode;
  banners: CampaignBannerUI[];
  onBanners: (next: CampaignBannerUI[]) => void;
}) {
  const b = banners.find((x) => x.id === id);
  const set = (patch: Partial<CampaignBannerUI>) => onBanners(upsertBanner(banners, id, kind, patch));

  return (
    <div className="space-y-2 p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        <div className="flex items-center gap-1">
          {badge ? (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              {badge}
            </span>
          ) : null}
          {tools}
        </div>
      </div>
      <CampaignBannerField
        value={b?.imageUrl}
        aspect={kind === "main" ? 8 / 3 : 2}
        ratioLabel={kind === "main" ? "8:3" : "2:1"}
        onChange={(url) => set({ imageUrl: url })}
      />
      {kind === "main" && b ? (
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

const toolBtn =
  "flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 cursor-pointer disabled:cursor-default";

/** Danh sách banner chính: thêm / xoá / đổi thứ tự slide. Ô chưa có ảnh chỉ giữ ở giao diện, không lưu. */
function MainBannerList({
  banners,
  onBanners,
}: {
  banners: CampaignBannerUI[];
  onBanners: (next: CampaignBannerUI[]) => void;
}) {
  const [empty, setEmpty] = useState<string[]>([]);
  const mainIds = banners.filter(isMain).map((b) => b.id);
  const ids = [...mainIds, ...empty.filter((id) => !mainIds.includes(id))];
  if (!ids.length) ids.push("main-1");

  /** Xoá ảnh của một slide thì giữ lại ô trống thay vì để ô biến mất. */
  const update = (next: CampaignBannerUI[]) => {
    const kept = new Set(next.filter(isMain).map((b) => b.id));
    const dropped = mainIds.filter((id) => !kept.has(id));
    if (dropped.length) setEmpty((e) => [...e, ...dropped.filter((id) => !e.includes(id))]);
    onBanners(next);
  };
  const remove = (id: string) => {
    setEmpty((e) => e.filter((x) => x !== id));
    onBanners(banners.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ids.map((id, i) => {
          const pos = mainIds.indexOf(id);
          return (
            <BannerCard
              key={id}
              id={id}
              kind="main"
              label={`Banner chính ${i + 1}`}
              badge={pos >= 0 ? `Slide ${pos + 1}` : "Chưa có ảnh"}
              banners={banners}
              onBanners={update}
              tools={
                <>
                  <button
                    type="button"
                    className={toolBtn}
                    disabled={pos <= 0}
                    onClick={() => onBanners(moveMain(banners, id, -1))}
                    aria-label="Chuyển slide lên trước"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className={toolBtn}
                    disabled={pos < 0 || pos >= mainIds.length - 1}
                    onClick={() => onBanners(moveMain(banners, id, 1))}
                    aria-label="Chuyển slide ra sau"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${toolBtn} hover:!border-rose-300 hover:!text-rose-600`}
                    disabled={ids.length <= 1 && pos < 0}
                    onClick={() => remove(id)}
                    aria-label="Xoá slide này"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              }
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={ids.length >= MAX_MAIN}
        onClick={() => setEmpty((e) => [...e, newMainId()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/50 px-3 py-2 text-xs font-semibold text-[#2D5A27] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        <Plus size={14} />
        Thêm banner chính ({ids.length}/{MAX_MAIN})
      </button>
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
            Hiện ở trang Ưu đãi (tab Flash Sale) trên máy tính. Điện thoại và trang chủ luôn hiện gọn &quot;Flash Sale&quot;.
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
          <p className="mt-1 text-[11px] text-slate-400">Ô vàng cạnh tiêu đề ở trang Ưu đãi, chỉ hiện trên máy tính. Để trống thì ẩn.</p>
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

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-500">
          Xem trước tiêu đề trang chủ{hasSlots ? " (đồng hồ chỉ hiện khi đang trong khung giờ mở bán)" : ""}
        </div>
        <FlashStagePreview countdown={hasSlots} />
        <p className="text-[11px] text-slate-400">
          Trang chủ luôn ghi gọn &quot;Flash Sale&quot; như các sàn; tên đợt sale đã nằm trên banner chính.
        </p>
      </div>
    </div>
  );
}

function FlashStagePreview({ countdown }: { countdown: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 shadow-2xs ring-1 ring-black/5"
      aria-label="Xem trước tiêu đề Flash Sale trang chủ"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex items-center gap-1 whitespace-nowrap text-[17px] font-black uppercase italic leading-none tracking-tight text-[#CE2D37]">
          <Zap className="h-4 w-4 fill-current" aria-hidden />
          Flash Sale
        </span>
        {countdown ? (
          <span className="flex items-center gap-0.5 text-[11px] font-bold tabular-nums text-slate-900">
            {["01", "24", "38"].map((n, i) => (
              <span key={n} className="flex items-center gap-0.5">
                {i ? <span aria-hidden>:</span> : null}
                <span className="min-w-[1.4rem] rounded-[4px] bg-slate-900 px-1 py-[3px] text-center leading-none text-white">
                  {n}
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#CE2D37]">
        Xem tất cả <ChevronRight size={14} aria-hidden />
      </span>
    </div>
  );
}

export function DisplayStep({ content, update, errors }: Props) {
  const display = content.display;
  const setDisplay = (patch: Partial<Display>) =>
    update((c) => ({ ...c, display: { ...c.display, ...patch } }));
  const setBanners = (banners: CampaignBannerUI[]) => setDisplay({ banners });
  const bannerErrors = fieldErrorsFor(errors, "display.banners");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Card 1: Ảnh banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            <ImageIcon size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Ảnh banner trang Ưu đãi</h3>
            <p className="text-xs text-slate-500">
              Hiển thị ở đầu trang Ưu đãi khi chiến dịch diễn ra (trang chủ giữ banner thương hiệu). Từ 2 banner
              chính trở lên thì tự trượt qua lại theo đúng thứ tự bên dưới.
            </p>
          </div>
        </div>

        <MainBannerList banners={display.banners} onBanners={setBanners} />

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="text-xs font-bold text-slate-700">Banner phụ (cạnh banner chính)</div>
          <div className="grid gap-4 md:grid-cols-2">
            {SIDE_SLOTS.map((s) => (
              <BannerCard
                key={s.id}
                id={s.id}
                kind="side"
                label={s.label}
                badge="Cạnh banner chính"
                banners={display.banners}
                onBanners={setBanners}
              />
            ))}
          </div>
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
