"use client";

import type { AppearanceTheme } from "../api";
import type { PopupAudience, PopupPages } from "@/lib/appearanceTypes";
import { ImageUploadField } from "../appearance/ImageUploadField";
import { combineLocalToIso, splitLocalFromIso } from "../appearance/editorUtils";
import { WbField, wbInput, wbSelect } from "../ui";
import { PopupStats } from "./PopupStats";

export type PopupValue = NonNullable<AppearanceTheme["popup"]>;

type Props = {
  popup: PopupValue;
  onChange: (patch: Partial<PopupValue>) => void;
  /** Ẩn ô "Mã chiến dịch" khi nơi dùng tự quản lý. */
  hideCampaignId?: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const PAGE_OPTIONS: { id: PopupPages; label: string }[] = [
  { id: "home", label: "Chỉ trang chủ (khuyên dùng)" },
  { id: "home_deals", label: "Trang chủ + trang Ưu đãi" },
  { id: "all", label: "Mọi trang (trừ giỏ hàng, thanh toán, tài khoản)" },
];

const AUDIENCE_OPTIONS: { id: PopupAudience; label: string }[] = [
  { id: "all", label: "Tất cả khách" },
  { id: "new", label: "Khách mới (chưa mua trên web, gồm khách chưa đăng nhập)" },
  { id: "returning", label: "Khách cũ (đã đăng nhập và từng mua)" },
];

function toLocalInput(iso: string | undefined): string {
  const { date, time } = splitLocalFromIso(iso);
  return date ? `${date}T${time}` : "";
}

function fromLocalInput(v: string): string {
  return v ? combineLocalToIso(v.slice(0, 10), v.slice(11, 16)) || "" : "";
}

/** Các ô cấu hình popup khuyến mãi (bật/tắt, ảnh, link, lịch, trang, đối tượng, tần suất). */
export function PopupFields({ popup, onChange, hideCampaignId }: Props) {
  const endBeforeStart =
    !!popup.startAt && !!popup.endAt && Date.parse(popup.endAt) <= Date.parse(popup.startAt);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[13px] text-gray-800">
        <input
          type="checkbox"
          checked={!!popup.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        Bật popup khuyến mãi trên web
      </label>
      <WbField
        label="Ảnh khuyến mãi (bắt buộc)"
        hint="PNG/WebP nền trong suốt, rộng khoảng 1000–1200px, chữ và nút nằm sẵn trong ảnh. Không vẽ nút X — web tự thêm."
      >
        <ImageUploadField
          kind="banner"
          value={popup.imageUrl || ""}
          onChange={(url) => onChange({ imageUrl: url })}
          previewClassName="overflow-hidden rounded-lg border border-gray-200"
        />
      </WbField>
      <WbField label="Link khi bấm ảnh" hint="VD: /uu-dai, /tim hoặc trang SP /sp/V1T">
        <input
          className={wbInput}
          value={popup.ctaHref || ""}
          onChange={(e) => onChange({ ctaHref: e.target.value })}
          placeholder="/uu-dai"
        />
      </WbField>
      {/* Cấu hình Banner thứ 2 cho Carousel Popup Shopee */}
      <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-rose-900">
            Banner thứ 2 (Slider Carousel xoay vòng Shopee)
          </span>
          <span className="text-[11px] text-rose-600 font-medium">Tự động xoay sau 3.5s</span>
        </div>
        <WbField
          label="Ảnh banner 2 (VD: Banner Siêu Sale 10/10)"
          hint="PNG/WebP, tỷ lệ vuông 1:1. Web đã chuẩn bị sẵn banner Siêu Sale 10/10."
        >
          <ImageUploadField
            kind="banner"
            value={popup.items?.[1]?.imageUrl ?? "/banners/popup-1010.webp"}
            onChange={(url) => {
              const baseItem0 = popup.items?.[0] || {
                imageUrl: popup.imageUrl,
                ctaHref: popup.ctaHref,
                title: popup.title,
                ctaLabel: popup.ctaLabel,
              };
              const item1 = {
                imageUrl: url,
                ctaHref: popup.items?.[1]?.ctaHref || "/uu-dai?src=popup&campaign=1010",
                title: popup.items?.[1]?.title || "Siêu Sale 10.10",
                ctaLabel: popup.items?.[1]?.ctaLabel || "Săn sale ngay",
              };
              onChange({ items: [baseItem0, item1] });
            }}
            previewClassName="overflow-hidden rounded-lg border border-gray-200"
          />
        </WbField>
        <WbField label="Link khi bấm banner 2" hint="VD: /uu-dai?src=popup&campaign=1010">
          <input
            className={wbInput}
            value={popup.items?.[1]?.ctaHref ?? "/uu-dai?src=popup&campaign=1010"}
            onChange={(e) => {
              const baseItem0 = popup.items?.[0] || {
                imageUrl: popup.imageUrl,
                ctaHref: popup.ctaHref,
                title: popup.title,
                ctaLabel: popup.ctaLabel,
              };
              const item1 = {
                imageUrl: popup.items?.[1]?.imageUrl || "/banners/popup-1010.webp",
                ctaHref: e.target.value,
                title: popup.items?.[1]?.title || "Siêu Sale 10.10",
                ctaLabel: popup.items?.[1]?.ctaLabel || "Săn sale ngay",
              };
              onChange({ items: [baseItem0, item1] });
            }}
            placeholder="/uu-dai?src=popup&campaign=1010"
          />
        </WbField>
      </div>
      {hideCampaignId ? null : (
        <WbField label="Mã chiến dịch" hint="Đổi mã khi muốn mọi khách thấy popup lại (chữ, số, - _ .).">
          <input
            className={wbInput}
            value={popup.campaignId || ""}
            onChange={(e) => onChange({ campaignId: e.target.value })}
            placeholder="promo"
          />
        </WbField>
      )}
      <div className="grid grid-cols-2 gap-2">
        <WbField label="Bắt đầu hiện" hint="Để trống = hiện ngay khi bật">
          <input
            type="datetime-local"
            className={wbInput}
            value={toLocalInput(popup.startAt)}
            onChange={(e) => onChange({ startAt: fromLocalInput(e.target.value) })}
          />
        </WbField>
        <WbField label="Tự tắt lúc" hint="Để trống = không tự tắt">
          <input
            type="datetime-local"
            className={wbInput}
            value={toLocalInput(popup.endAt)}
            onChange={(e) => onChange({ endAt: fromLocalInput(e.target.value) })}
          />
        </WbField>
      </div>
      {endBeforeStart ? (
        <p className="text-[11px] text-red-600">Giờ tắt phải sau giờ bắt đầu — khi lưu sẽ bỏ giờ tắt.</p>
      ) : null}
      <WbField label="Hiện ở trang">
        <select
          className={wbSelect}
          value={popup.pages || "home"}
          onChange={(e) => onChange({ pages: e.target.value as PopupPages })}
        >
          {PAGE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </WbField>
      <WbField label="Ai thấy popup">
        <select
          className={wbSelect}
          value={popup.audience || "all"}
          onChange={(e) => onChange({ audience: e.target.value as PopupAudience })}
        >
          {AUDIENCE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </WbField>
      <div className="grid grid-cols-2 gap-2">
        <WbField label="Trễ (giây)" hint="Khuyên 3–5 giây; khách cuộn 1/3 trang thì hiện sớm">
          <input
            type="number"
            min={0}
            max={30}
            className={wbInput}
            value={Number(popup.delaySeconds) || 0}
            onChange={(e) => onChange({ delaySeconds: clamp(Number(e.target.value) || 0, 0, 30) })}
          />
        </WbField>
        <WbField label="Hiện lại sau (ngày)">
          <input
            type="number"
            min={1}
            max={90}
            className={wbInput}
            value={Number(popup.frequencyDays) || 7}
            onChange={(e) =>
              onChange({ frequencyDays: clamp(Number(e.target.value) || 7, 1, 90) })
            }
          />
        </WbField>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-gray-700">
        <input
          type="checkbox"
          checked={popup.showOncePerCampaign !== false}
          onChange={(e) => onChange({ showOncePerCampaign: e.target.checked })}
        />
        Mỗi chiến dịch chỉ hiện 1 lần (sau khi đóng)
      </label>
      <label className="flex items-center gap-2 text-[12px] text-gray-700">
        <input
          type="checkbox"
          checked={popup.reopenBadge !== false}
          onChange={(e) => onChange({ reopenBadge: e.target.checked })}
        />
        Sau khi đóng, để ảnh nhỏ ở góc màn hình để khách mở lại
      </label>
      <p className="text-[11px] text-gray-500">
        Mỗi lần vào web khách chỉ thấy popup tự bật 1 lần; đã đóng thì quay về trang chủ hay sang trang khác
        cũng không hiện lại.
      </p>
      {popup.campaignId?.trim() ? <PopupStats campaignId={popup.campaignId} /> : null}
    </div>
  );
}
