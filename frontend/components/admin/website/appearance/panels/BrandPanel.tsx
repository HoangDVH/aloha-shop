"use client";

import React from "react";
import { Check, Globe, Megaphone, Palette, Type } from "lucide-react";
import {
  FONT_OPTIONS,
  type AppearanceFontFamily,
  type AppearanceLayout,
  type AppearanceTheme,
} from "../../api";
import { BrandAccordion, type BrandSectionId } from "../BrandAccordion";
import { ImageUploadField } from "../ImageUploadField";
import {
  COLOR_PRESETS,
  HEADER_FOR_PRIMARY,
  emptyPopup,
} from "../editorUtils";
import {
  WbField,
  WbSectionLabel,
  wbInput,
  wbSelect,
} from "../../ui";

export function BrandPanel({
  draft,
  setDraft,
  primary,
  brandOpen,
  setBrandOpen,
  patchTheme,
  patchPopup,
}: {
  draft: AppearanceLayout;
  setDraft: React.Dispatch<React.SetStateAction<AppearanceLayout | null>>;
  primary: string;
  brandOpen: BrandSectionId | null;
  setBrandOpen: (id: BrandSectionId | null) => void;
  patchTheme: (partial: Partial<AppearanceTheme>) => void;
  patchPopup: (p: Partial<NonNullable<AppearanceTheme["popup"]>>) => void;
}) {
  const popup = draft.theme.popup || emptyPopup();
  const seo = draft.theme.seo || { title: "", description: "" };

  return (
    <div className="space-y-3">
      <WbSectionLabel>Thương hiệu & SEO</WbSectionLabel>
      <p className="text-[11px] text-gray-500">
        Bấm từng mục để mở form sửa — giống tab Trang chủ.
      </p>
      <BrandAccordion
        openId={brandOpen}
        onOpen={setBrandOpen}
        primary={primary}
        items={[
          {
            id: "color",
            label: "Màu chủ đạo",
            hint: primary,
            Icon: Palette,
            body: (
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => {
                  const on = primary.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          theme: {
                            ...draft.theme,
                            primaryColor: c,
                            headerBg: HEADER_FOR_PRIMARY,
                          },
                        })
                      }
                      className={`relative h-8 w-8 rounded-full transition ${
                        on
                          ? "ring-2 ring-gray-900 ring-offset-2"
                          : "ring-1 ring-black/10 hover:scale-105"
                      }`}
                      style={{ background: c }}
                    >
                      {on ? (
                        <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />
                      ) : null}
                    </button>
                  );
                })}
                <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-gray-200 hover:ring-gray-300">
                  <input
                    type="color"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    value={primary}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        theme: {
                          ...draft.theme,
                          primaryColor: e.target.value,
                          headerBg: HEADER_FOR_PRIMARY,
                        },
                      })
                    }
                  />
                  <span className="flex h-full w-full items-center justify-center bg-gray-50 text-xs font-bold text-gray-400">
                    +
                  </span>
                </label>
              </div>
            ),
          },
          {
            id: "identity",
            label: "Tên · Logo · Font · Favicon",
            hint: draft.theme.siteName || "Chưa đặt tên",
            Icon: Type,
            body: (
              <div className="space-y-3">
                <WbField label="Tên shop">
                  <input
                    className={wbInput}
                    value={draft.theme.siteName || ""}
                    onChange={(e) =>
                      patchTheme({ siteName: e.target.value })
                    }
                  />
                </WbField>
                <WbField label="Font chữ">
                  <select
                    className={wbSelect}
                    value={draft.theme.fontFamily || "system"}
                    onChange={(e) =>
                      patchTheme({
                        fontFamily: e.target.value as AppearanceFontFamily,
                      })
                    }
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </WbField>
                <WbField
                  label="Logo"
                  hint="PNG/WebP nền trong suốt — tối đa 4MB."
                >
                  <ImageUploadField
                    kind="logo"
                    value={draft.theme.logoUrl || ""}
                    onChange={(url) => patchTheme({ logoUrl: url })}
                    hint="PNG trong suốt · tối đa 4MB"
                    previewClassName="overflow-hidden rounded-lg border border-gray-200"
                    previewBg={primary}
                  />
                </WbField>
                <WbField label="URL logo (tuỳ chọn)">
                  <input
                    className={wbInput}
                    value={draft.theme.logoUrl || ""}
                    onChange={(e) =>
                      patchTheme({ logoUrl: e.target.value })
                    }
                    placeholder="/brand/logo-header-on-theme.png"
                  />
                </WbField>
                <WbField
                  label="Favicon"
                  hint="Icon tab trình duyệt · PNG/WebP vuông."
                >
                  <ImageUploadField
                    kind="favicon"
                    value={draft.theme.faviconUrl || ""}
                    onChange={(url) => patchTheme({ faviconUrl: url })}
                    hint="Favicon · tối đa 4MB"
                    previewClassName="overflow-hidden rounded-lg border border-gray-200"
                  />
                </WbField>
              </div>
            ),
          },
          {
            id: "seo",
            label: "SEO trang chủ",
            hint: "Chỉnh trong tab Tối ưu SEO",
            Icon: Globe,
            body: (
              <div className="space-y-3">
                <p className="text-[12px] leading-relaxed text-slate-600">
                  Tiêu đề, mô tả, ảnh OG và template sản phẩm/danh mục
                  được quản lý tại tab <strong>Tối ưu SEO</strong> (sidebar).
                </p>
                <a
                  href="/admin/seo"
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--aloha-green)] px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[var(--aloha-green-mid)]"
                >
                  Mở tab Tối ưu SEO
                </a>
                {(seo.title || seo.description) && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                    <p className="font-semibold text-slate-800">
                      {seo.title || "—"}
                    </p>
                    <p className="mt-0.5 line-clamp-2">
                      {seo.description || ""}
                    </p>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "popup",
            label: "Popup khuyến mãi",
            hint: popup.enabled
              ? popup.imageUrl
                ? "Bật · có ảnh"
                : "Bật · chưa có ảnh"
              : "Đang tắt",
            Icon: Megaphone,
            body: (
              <div className="space-y-3">
                <p className="text-[11px] leading-snug text-amber-800/90">
                  Kiểu sàn: <strong>chỉ hiện ảnh</strong>. Cần ảnh +{" "}
                  <strong>Áp dụng</strong>. API (:3000) phải chạy. Đã đóng rồi →
                  đổi mã chiến dịch, hoặc mở{" "}
                  <code className="rounded bg-amber-100 px-1">?popup=1</code>{" "}
                  để xem lại.
                </p>
                <label className="flex items-center gap-2 text-[13px] text-gray-800">
                  <input
                    type="checkbox"
                    checked={!!popup.enabled}
                    onChange={(e) =>
                      patchPopup({ enabled: e.target.checked })
                    }
                  />
                  Bật popup khuyến mãi trên web
                </label>
                <WbField
                  label="Ảnh khuyến mãi (bắt buộc)"
                  hint="Chữ KM nên nằm sẵn trong ảnh. Ảnh đứng/vuông đẹp nhất."
                >
                  <ImageUploadField
                    kind="banner"
                    value={popup.imageUrl || ""}
                    onChange={(url) => patchPopup({ imageUrl: url })}
                    previewClassName="overflow-hidden rounded-lg border border-gray-200"
                  />
                </WbField>
                <WbField
                  label="Link khi bấm ảnh"
                  hint="VD trang SP: /sp/V1T hoặc /tim"
                >
                  <input
                    className={wbInput}
                    value={popup.ctaHref || ""}
                    onChange={(e) =>
                      patchPopup({ ctaHref: e.target.value })
                    }
                    placeholder="/sp/..."
                  />
                </WbField>
                <WbField
                  label="Mã chiến dịch"
                  hint="Đổi mã khi muốn khách thấy popup lại."
                >
                  <input
                    className={wbInput}
                    value={popup.campaignId || ""}
                    onChange={(e) =>
                      patchPopup({ campaignId: e.target.value })
                    }
                    placeholder="promo"
                  />
                </WbField>
                <div className="grid grid-cols-2 gap-2">
                  <WbField label="Trễ (giây)">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      className={wbInput}
                      value={Number(popup.delaySeconds) || 0}
                      onChange={(e) =>
                        patchPopup({
                          delaySeconds: Math.max(
                            0,
                            Math.min(120, Number(e.target.value) || 0)
                          ),
                        })
                      }
                    />
                  </WbField>
                  <WbField label="Hiện lại sau (ngày)">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className={wbInput}
                      value={Number(popup.frequencyDays) || 7}
                      onChange={(e) =>
                        patchPopup({
                          frequencyDays: Math.max(
                            1,
                            Math.min(365, Number(e.target.value) || 7)
                          ),
                        })
                      }
                    />
                  </WbField>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={popup.showOncePerCampaign !== false}
                    onChange={(e) =>
                      patchPopup({
                        showOncePerCampaign: e.target.checked,
                      })
                    }
                  />
                  Mỗi chiến dịch chỉ hiện 1 lần (sau khi đóng)
                </label>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
