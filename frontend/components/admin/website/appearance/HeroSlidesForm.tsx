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

/** Khớp HeroBanner — sản phẩm, cây cảnh, khách sỉ, cộng tác viên. */
export const DEFAULT_HERO_SLIDES: HeroSlideDraft[] = [
  {
    src: "/banners/banner-hero-01.png?v=23",
    alt: "ALOHA — Đa dạng mẫu mã, phối theo yêu cầu",
    href: "/tim",
    label: "TẤT CẢ SẢN PHẨM",
  },
  {
    src: "/banners/banner-hero-03.png?v=22",
    alt: "ALOHA — Sản phẩm chất lượng, tuyển chọn kỹ",
    href: "/danh-muc/cay-canh-du-loai",
    label: "CÂY CẢNH",
  },
  {
    src: "/banners/banner-hero-02.png?v=22",
    alt: "ALOHA — Ưu đãi và dịch vụ dành cho khách sỉ",
    href: "/dang-ky-si",
    label: "KHÁCH SỈ",
  },
  {
    src: "/banners/bannerctv.png?v=7",
    alt: "Cộng tác viên Aloha — Trở thành CTV Aloha, kiếm thêm thu nhập cùng Aloha",
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
  onChange: (next: {
    slides: HeroSlideDraft[];
    useDefaultBanners: boolean;
  }) => void;
}) {
  const saved = Array.isArray(slides) ? slides : [];
  const onDefaults = useDefaultBanners || !saved.some((s) => s.src);

  /** Hiển thị đủ 4 banner mặc định, không để danh sách trống. */
  const list = useMemo(
    () => (onDefaults ? cloneDefaults() : saved),
    [onDefaults, saved],
  );

  /** Mọi thao tác sửa đều giữ các slide hiện có. */
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
            ? "Đang dùng 4 banner mặc định. Đổi ảnh / thêm slide sẽ giữ các banner còn lại."
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
            <span className="text-[12px] font-semibold text-gray-800">
              Slide {idx + 1}
            </span>
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
