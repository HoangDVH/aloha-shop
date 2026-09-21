"use client";

import { useEffect, useMemo, useState } from "react";
import { shortFilterLabel } from "@/components/FilterChipSection";

/** Số nhóm thuộc tính hiện trước khi «Mở rộng». */
const PREVIEW_NAMES = 4;
/** Số giá trị/chip hiện trước khi «Xem thêm» trong một nhóm. */
const PREVIEW_VALUES = 12;

type Props = {
  /** Tên attr → danh sách giá trị (đã theo mục navbar từ API facets) */
  attributes: Record<string, string[]>;
  /** Token đang chọn dạng Name:Value */
  selected: string[];
  onToggle: (token: string) => void;
  loading?: boolean;
  /** Chưa chọn nhóm → gợi ý như Shopee */
  needCategory?: boolean;
};

/**
 * Lọc thuộc tính kiểu Thế Giới Di Động:
 * mỗi thuộc tính một hàng tiêu đề + các ô giá trị bọc xuống dòng.
 */
export function ShopAttributeFilter({
  attributes,
  selected,
  onToggle,
  loading,
  needCategory,
}: Props) {
  const names = useMemo(() => Object.keys(attributes || {}), [attributes]);
  const [expandedList, setExpandedList] = useState(false);
  const [moreByName, setMoreByName] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedList(false);
    setMoreByName({});
  }, [names.join("|")]);

  if (needCategory) {
    return (
      <div className="border-t border-[#f0ebe3] pt-4">
        <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--aloha-ink)]">
          Thuộc tính
        </h3>
        <p className="text-xs leading-relaxed text-slate-500">
          Chọn danh mục / nhóm hàng để hiện thuộc tính tương ứng (Size, màu…).
        </p>
      </div>
    );
  }

  if (loading && !names.length) {
    return (
      <div className="border-t border-[#f0ebe3] pt-4">
        <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--aloha-ink)]">
          Thuộc tính
        </h3>
        <p className="text-xs text-slate-400">Đang tải…</p>
      </div>
    );
  }

  if (!names.length) return null;

  const visibleNames = expandedList ? names : names.slice(0, PREVIEW_NAMES);
  const canExpand = names.length > PREVIEW_NAMES;

  return (
    <div className="border-t border-[#f0ebe3] pt-4">
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-[var(--aloha-ink)]">
        Thuộc tính
      </h3>

      <div className="space-y-4">
        {visibleNames.map((name) => {
          const values = attributes[name] || [];
          if (!values.length) return null;
          const showAll = Boolean(moreByName[name]);
          const visible = showAll ? values : values.slice(0, PREVIEW_VALUES);
          const rest = Math.max(0, values.length - PREVIEW_VALUES);

          return (
            <div key={name}>
              <p className="mb-2 text-[13px] font-bold text-[#222]">{name}</p>
              <div className="flex flex-wrap gap-2">
                {visible.map((v) => {
                  const token = `${name}:${v}`;
                  const active = selected.includes(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      title={v}
                      onClick={() => onToggle(token)}
                      className={`inline-flex max-w-full items-center justify-center rounded-md border bg-white px-3 py-2 text-left text-[13px] font-medium leading-snug transition ${
                        active
                          ? "border-[var(--aloha-green)] text-[var(--aloha-green)] ring-1 ring-[var(--aloha-green)]"
                          : "border-[#e0e0e0] text-[#333] hover:border-[var(--aloha-green)]/50"
                      }`}
                    >
                      <span className="line-clamp-2">{shortFilterLabel(v, 36)}</span>
                    </button>
                  );
                })}
              </div>
              {rest > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setMoreByName((m) => ({ ...m, [name]: !m[name] }))
                  }
                  className="mt-2 text-[13px] font-medium text-slate-600 hover:text-[var(--aloha-green)]"
                >
                  {showAll ? "Thu gọn ∧" : `Xem thêm ${rest} ∨`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpandedList((v) => !v)}
          className="mt-3 text-[13px] font-medium text-slate-600 hover:text-[var(--aloha-green)]"
        >
          {expandedList
            ? "Thu gọn ∧"
            : `Mở rộng (+${names.length - PREVIEW_NAMES}) ∨`}
        </button>
      ) : null}
    </div>
  );
}
