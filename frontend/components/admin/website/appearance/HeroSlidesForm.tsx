"use client";

import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ImageUploadField } from "./ImageUploadField";
import { WbBtn, WbField, wbInput } from "../ui";

export type HeroSlideDraft = {
  src: string;
  alt: string;
  href?: string;
  label?: string;
};

/** Khớp HeroBanner — 4 ảnh ALOHA: khách sỉ, đất/dụng cụ, hạt giống, cây cảnh. */
export const DEFAULT_HERO_SLIDES: HeroSlideDraft[] = [
  {
    src: "/banners/banner-hero-01.png?v=13",
    alt: "Ưu đãi dịch vụ khách sỉ ALOHA",
    href: "/tim?q=bao+gia+si",
    label: "KHÁCH SỈ",
  },
  {
    src: "/banners/banner-hero-02.png?v=13",
    alt: "Đất trồng phân bón dụng cụ chăm sóc cây",
    href: "/tim?q=dat+trong",
    label: "ĐẤT TRỒNG",
  },
  {
    src: "/banners/banner-hero-03.png?v=13",
    alt: "Hạt giống ALOHA",
    href: "/tim?q=hat+giong",
    label: "HẠT GIỐNG",
  },
  {
    src: "/banners/banner-hero-04.png?v=5",
    alt: "Cộng tác viên Aloha — Chia sẻ cây xanh, nhận hoa hồng",
    href: "/tuyen-ctv",
    label: "CTV ALOHA",
  },
];

function newSlide(): HeroSlideDraft {
  return { src: "", alt: "", href: "/tim", label: "" };
}

function cloneDefaults() {
  return DEFAULT_HERO_SLIDES.map((s) => ({ ...s }));
}

export function HeroSlidesForm({
  slides,
  useDefaultBanners,
  onChange,
}: {
  slides: HeroSlideDraft[];
  useDefaultBanners: boolean;
  onChange: (next: { slides: HeroSlideDraft[]; useDefaultBanners: boolean }) => void;
}) {
  const saved = Array.isArray(slides) ? slides : [];
  const onDefaults = useDefaultBanners || !saved.some((s) => s.src);

  /** Hiển thị: nếu còn mặc định thì hiện đủ 3 banner cũ để sửa, không để list trống. */
  const list = useMemo(
    () => (onDefaults ? cloneDefaults() : saved),
    [onDefaults, saved]
  );

  /** Mọi thao tác sửa đều giữ các slide hiện có (gồm 3 mặc định nếu đang ở chế độ mặc định). */
  const commit = (next: HeroSlideDraft[]) => {
    const withSrc = next.filter((s) => String(s.src || "").trim());
    if (!withSrc.length) {
      onChange({ slides: [], useDefaultBanners: true });
      return;
    }
    onChange({ slides: next.map((s) => ({ ...s })), useDefaultBanners: false });
  };

  const updateAt = (idx: number, patch: Partial<HeroSlideDraft>) => {
    commit(list.map((s, i) => (i === idx ? { ...s, ...patch } : { ...s })));
  };

  const removeAt = (idx: number) => {
    const next = list.filter((_, i) => i !== idx).map((s) => ({ ...s }));
    if (!next.some((s) => s.src)) {
      onChange({ slides: [], useDefaultBanners: true });
      return;
    }
    commit(next);
  };

  const addSlide = () => {
    commit([...list.map((s) => ({ ...s })), newSlide()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] leading-relaxed text-gray-500">
          {onDefaults
            ? "Đang dùng 3 banner mặc định. Đổi ảnh / thêm slide sẽ giữ các banner còn lại."
            : "Slide tùy chỉnh — Áp dụng để khách thấy. Ảnh giữ nguyên tỉ lệ (không cắt chữ)."}
        </p>
        {!onDefaults ? (
          <WbBtn
            variant="ghost"
            className="!h-7 shrink-0 !px-2 text-[11px]"
            onClick={() => onChange({ slides: [], useDefaultBanners: true })}
          >
            Mặc định
          </WbBtn>
        ) : null}
      </div>

      {list.map((slide, idx) => (
        <div
          key={`${slide.src || "empty"}-${idx}`}
          className="space-y-2 rounded-xl border border-gray-200 bg-white p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-gray-800">Slide {idx + 1}</span>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md border-0 bg-transparent px-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
              style={{ border: "none" }}
              onClick={() => removeAt(idx)}
              disabled={list.length <= 1}
              title={list.length <= 1 ? "Giữ ít nhất 1 slide" : "Xóa slide"}
            >
              <Trash2 className="h-3 w-3" /> Xóa
            </button>
          </div>
          <ImageUploadField
            kind="banner"
            value={slide.src}
            onChange={(url) => updateAt(idx, { src: url })}
            hint="Giữ nguyên tỉ lệ · JPG/PNG/WebP · tối đa 4MB"
          />
          <WbField label="Nhãn trên ảnh">
            <input
              className={wbInput}
              value={slide.label || ""}
              placeholder="VD: CHẬU CẢNH"
              onChange={(e) => updateAt(idx, { label: e.target.value })}
            />
          </WbField>
          <WbField label="Alt / mô tả">
            <input
              className={wbInput}
              value={slide.alt || ""}
              placeholder="Mô tả ảnh"
              onChange={(e) => updateAt(idx, { alt: e.target.value })}
            />
          </WbField>
          <WbField label="Link khi bấm">
            <input
              className={wbInput}
              value={slide.href || ""}
              placeholder="/tim"
              onChange={(e) => updateAt(idx, { href: e.target.value })}
            />
          </WbField>
        </div>
      ))}

      <WbBtn
        variant="secondary"
        className="!h-8 w-full justify-center"
        onClick={addSlide}
      >
        <Plus className="h-3.5 w-3.5" /> Thêm slide
      </WbBtn>
    </div>
  );
}
