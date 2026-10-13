"use client";

import type { AppearanceTheme } from "../api";
import type { PopupAudience, PopupPages, PopupBannerItem } from "@/lib/appearanceTypes";
import { Eye, EyeOff } from "lucide-react";
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
  const everyVisit = popup.everyVisit === true;

  // Banner 1: mặc định theo popup.imageUrl/ctaHref nếu items[0] chưa khởi tạo
  const banner1Img = popup.items?.[0]?.imageUrl ?? popup.imageUrl ?? "";
  const banner1Href = popup.items?.[0]?.ctaHref ?? popup.ctaHref ?? "/uu-dai";
  const isBanner1Enabled = popup.items?.[0]?.enabled !== false;

  // Banner 2: mặc định theo items[1] hoặc banner 10/10 có sẵn
  const banner2Img = popup.items?.[1]?.imageUrl ?? "/banners/popup-1010.webp";
  const banner2Href = popup.items?.[1]?.ctaHref ?? "/uu-dai?src=popup&campaign=1010";
  const isBanner2Enabled = popup.items?.[1]?.enabled !== false;

  const updateBanner1 = (patch: Partial<PopupBannerItem>) => {
    const nextItem0: PopupBannerItem = {
      imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : banner1Img,
      ctaHref: patch.ctaHref !== undefined ? patch.ctaHref : banner1Href,
      title: patch.title !== undefined ? patch.title : (popup.items?.[0]?.title || popup.title || "Ưu đãi"),
      ctaLabel: patch.ctaLabel !== undefined ? patch.ctaLabel : (popup.items?.[0]?.ctaLabel || popup.ctaLabel || "Xem ngay"),
      enabled: patch.enabled !== undefined ? patch.enabled : isBanner1Enabled,
    };
    const nextItem1: PopupBannerItem = {
      imageUrl: banner2Img,
      ctaHref: banner2Href,
      title: popup.items?.[1]?.title || "Siêu Sale 10.10",
      ctaLabel: popup.items?.[1]?.ctaLabel || "Săn sale ngay",
      enabled: isBanner2Enabled,
    };
    onChange({
      imageUrl: nextItem0.imageUrl,
      ctaHref: nextItem0.ctaHref,
      items: [nextItem0, nextItem1],
    });
  };

  const updateBanner2 = (patch: Partial<PopupBannerItem>) => {
    const nextItem0: PopupBannerItem = {
      imageUrl: banner1Img,
      ctaHref: banner1Href,
      title: popup.items?.[0]?.title || popup.title || "Ưu đãi",
      ctaLabel: popup.items?.[0]?.ctaLabel || popup.ctaLabel || "Xem ngay",
      enabled: isBanner1Enabled,
    };
    const nextItem1: PopupBannerItem = {
      imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : banner2Img,
      ctaHref: patch.ctaHref !== undefined ? patch.ctaHref : banner2Href,
      title: patch.title !== undefined ? patch.title : (popup.items?.[1]?.title || "Siêu Sale 10.10"),
      ctaLabel: patch.ctaLabel !== undefined ? patch.ctaLabel : (popup.items?.[1]?.ctaLabel || "Săn sale ngay"),
      enabled: patch.enabled !== undefined ? patch.enabled : isBanner2Enabled,
    };
    onChange({
      imageUrl: nextItem0.imageUrl,
      ctaHref: nextItem0.ctaHref,
      items: [nextItem0, nextItem1],
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[13px] font-medium text-gray-800">
        <input
          type="checkbox"
          checked={!!popup.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        Bật popup khuyến mãi trên web
      </label>

      {/* Tóm tắt trạng thái hiển thị Popup */}
      <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 text-[12px] text-blue-950">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-700">Trạng thái hiển thị popup:</span>
          {isBanner1Enabled && isBanner2Enabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              🎠 Xoay vòng 2 banner (Shopee Carousel 3.5s)
            </span>
          ) : isBanner1Enabled && !isBanner2Enabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
              🖼️ Hiện 1 popup tĩnh (Chỉ Banner 1)
            </span>
          ) : !isBanner1Enabled && isBanner2Enabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
              🖼️ Hiện 1 popup tĩnh (Chỉ Banner 2)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800 border border-red-200">
              🚫 Cả 2 banner đều đang ẩn (Popup sẽ không xuất hiện)
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-gray-600">
          Bạn có thể nhấn nút <strong>Ẩn/Hiện</strong> ở từng banner bên dưới để cấu hình hiển thị 1 banner đơn lẻ hoặc cả 2 banner xoay vòng.
        </p>
      </div>

      {/* Cấu hình Banner 1 */}
      <div
        className={`rounded-xl border p-3 space-y-2.5 transition-all ${
          isBanner1Enabled
            ? "border-emerald-200/80 bg-emerald-50/40"
            : "border-gray-200 bg-gray-50/70 opacity-80"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">
              Banner 1 (Banner chính)
            </span>
            {isBanner1Enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Đang hiện
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 border border-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                Đã ẩn
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => updateBanner1({ enabled: !isBanner1Enabled })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all shadow-xs cursor-pointer ${
              isBanner1Enabled
                ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 active:scale-95"
                : "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 active:scale-95"
            }`}
            title={isBanner1Enabled ? "Bấm để ẩn Banner 1 trên website" : "Bấm để hiện Banner 1 trên website"}
          >
            {isBanner1Enabled ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-amber-700" />
                <span>Ẩn popup 1</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-emerald-700" />
                <span>Hiện popup 1</span>
              </>
            )}
          </button>
        </div>

        {!isBanner1Enabled && (
          <p className="rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-[11px] text-amber-800">
            ⚠️ <strong>Banner 1 đang bị ẩn</strong>: Khách vào website sẽ không nhìn thấy banner này.
          </p>
        )}

        <WbField
          label="Ảnh Banner 1"
          hint="PNG/WebP, tỷ lệ vuông 1:1 hoặc chữ nhật. Chữ và nút nằm sẵn trong ảnh. Không vẽ nút X — web tự thêm."
        >
          <ImageUploadField
            kind="banner"
            value={banner1Img}
            onChange={(url) => updateBanner1({ imageUrl: url })}
            previewClassName="overflow-hidden rounded-lg border border-gray-200"
          />
        </WbField>
        <WbField label="Link khi bấm Banner 1" hint="VD: /uu-dai, /tim hoặc trang SP /sp/V1T">
          <input
            className={wbInput}
            value={banner1Href}
            onChange={(e) => updateBanner1({ ctaHref: e.target.value })}
            placeholder="/uu-dai"
          />
        </WbField>
      </div>

      {/* Cấu hình Banner 2 */}
      <div
        className={`rounded-xl border p-3 space-y-2.5 transition-all ${
          isBanner2Enabled
            ? "border-rose-200/80 bg-rose-50/50"
            : "border-gray-200 bg-gray-50/70 opacity-80"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">
              Banner 2 (Slider Carousel Shopee)
            </span>
            {isBanner2Enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                Đang hiện
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 border border-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                Đã ẩn
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => updateBanner2({ enabled: !isBanner2Enabled })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all shadow-xs cursor-pointer ${
              isBanner2Enabled
                ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 active:scale-95"
                : "border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 active:scale-95"
            }`}
            title={isBanner2Enabled ? "Bấm để ẩn Banner 2 trên website" : "Bấm để hiện Banner 2 trên website"}
          >
            {isBanner2Enabled ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-amber-700" />
                <span>Ẩn popup 2</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-rose-700" />
                <span>Hiện popup 2</span>
              </>
            )}
          </button>
        </div>

        {isBanner2Enabled ? (
          <p className="text-[11px] text-rose-700 font-medium">
            Tự động xoay sau 3.5s cùng Banner 1 nếu cả 2 cùng được bật.
          </p>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-[11px] text-amber-800">
            ⚠️ <strong>Banner 2 đang bị ẩn</strong>: Website sẽ hiển thị tĩnh Banner 1 (không có thanh trượt xoay vòng).
          </p>
        )}

        <WbField
          label="Ảnh Banner 2 (VD: Banner Siêu Sale 10/10)"
          hint="PNG/WebP, tỷ lệ vuông 1:1. Web đã chuẩn bị sẵn banner Siêu Sale 10/10."
        >
          <ImageUploadField
            kind="banner"
            value={banner2Img}
            onChange={(url) => updateBanner2({ imageUrl: url })}
            previewClassName="overflow-hidden rounded-lg border border-gray-200"
          />
        </WbField>
        <WbField label="Link khi bấm Banner 2" hint="VD: /uu-dai?src=popup&campaign=1010">
          <input
            className={wbInput}
            value={banner2Href}
            onChange={(e) => updateBanner2({ ctaHref: e.target.value })}
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
            disabled={everyVisit}
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
          checked={everyVisit}
          onChange={(e) => onChange({ everyVisit: e.target.checked })}
        />
        Mỗi lần khách mở web đều hiện lại (kể cả đã đóng ở lần vào trước)
      </label>
      <label
        className={`flex items-center gap-2 text-[12px] text-gray-700 ${everyVisit ? "opacity-50" : ""}`}
      >
        <input
          type="checkbox"
          disabled={everyVisit}
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
        cũng không hiện lại.{" "}
        {everyVisit
          ? "Tắt tab rồi mở web lại sẽ hiện lần nữa."
          : "Tắt tab rồi mở lại vẫn không hiện cho tới khi hết số ngày ở trên."}
      </p>
      {popup.campaignId?.trim() ? <PopupStats campaignId={popup.campaignId} /> : null}
    </div>
  );
}
