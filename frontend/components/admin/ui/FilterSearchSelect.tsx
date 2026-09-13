"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { normalizeString } from "@/components/admin/utils/productSearch";

type Option = { value: string; label: string };

type Props = {
  label?: string;
  value: string;
  options: Option[];
  /** Text hiện khi chưa chọn — kiểu KV thuộc tính (MÀU ÁO…) */
  placeholder?: string;
  allLabel?: string;
  emptyHint?: string;
  onChange: (value: string) => void;
  className?: string;
  /** Chữ hoa placeholder + option như thuộc tính KV */
  uppercase?: boolean;
  /** Hiện nút X khi có giá trị */
  clearable?: boolean;
  /** Chỉ hiện N dòng giá trị đầu; còn lại bấm Mở rộng / Thu gọn */
  maxVisibleOptions?: number;
};

const ACCENT = "#3D6B3A";

/**
 * Dropdown kiểu KiotViet (ảnh thuộc tính): ô nhập + list xổ xuống + nút X xóa.
 */
export function FilterSearchSelect({
  label,
  value,
  options,
  placeholder = "Chọn…",
  allLabel,
  emptyHint = "Không có dữ liệu",
  onChange,
  className = "",
  uppercase = false,
  clearable = true,
  maxVisibleOptions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [listExpanded, setListExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((o) => o.value === value)?.label || value;
  }, [value, options]);

  const filtered = useMemo(() => {
    const term = normalizeString(q);
    const list = options.filter((o) => o.value);
    if (!term) return list;
    return list.filter(
      (o) => normalizeString(o.label).includes(term) || normalizeString(o.value).includes(term)
    );
  }, [options, q]);

  const visibleOpts = useMemo(() => {
    const limit = Number(maxVisibleOptions) || 0;
    if (!limit || listExpanded || filtered.length <= limit) return filtered;
    return filtered.slice(0, limit);
  }, [filtered, listExpanded, maxVisibleOptions]);

  const hiddenCount =
    maxVisibleOptions && !listExpanded && filtered.length > maxVisibleOptions
      ? filtered.length - maxVisibleOptions
      : 0;

  useEffect(() => {
    if (!open) {
      setListExpanded(false);
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
        setListExpanded(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const displayText = open ? q : selectedLabel;
  const showPlaceholder = !open && !value;

  const clear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onChange("");
    setQ("");
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {label ? (
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[12.5px] font-semibold text-[#1F3A24]">{label}</div>
          {clearable && value ? (
            <button
              type="button"
              onClick={clear}
              className="w-5 h-5 rounded-full border-0 bg-[#F0F2F0] text-[#5A6B5E] flex items-center justify-center cursor-pointer hover:bg-[#E5E8E5]"
              title="Xóa lọc"
              aria-label="Xóa lọc"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`flex items-center gap-1 h-9 px-2.5 rounded-md border bg-white transition-colors ${
          open ? "border-[#3D6B3A] ring-1 ring-[#3D6B3A]/25" : "border-[#D4CDC0] hover:border-[#3D6B3A]/70"
        }`}
        onClick={() => {
          setOpen(true);
          setQ("");
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <input
          ref={inputRef}
          value={displayText}
          onChange={(e) => {
            const v = uppercase ? e.target.value.toUpperCase() : e.target.value;
            setQ(v);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          placeholder={showPlaceholder ? placeholder : undefined}
          className={`filter-search-input flex-1 min-w-0 h-full border-0 outline-none shadow-none ring-0 appearance-none text-[13px] bg-transparent p-0 m-0 focus:border-0 focus:outline-none focus:ring-0 ${
            uppercase || showPlaceholder ? "uppercase" : ""
          } ${showPlaceholder ? "placeholder:text-[#98a2b3]" : "text-[#1F3A24]"}`}
        />
        {clearable && value && !open ? (
          <button
            type="button"
            onClick={clear}
            className="w-5 h-5 shrink-0 rounded-full border-0 bg-transparent text-[#98a2b3] hover:text-[#c62828] flex items-center justify-center cursor-pointer"
            title="Xóa"
            aria-label="Xóa"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-[#98a2b3] transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {open && (
        <div className="absolute z-[90] left-0 right-0 mt-1 rounded-md border border-[#E5DFD2] bg-white shadow-[0_8px_20px_rgba(31,58,36,0.12)] overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto py-1">
            {allLabel ? (
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left text-[13px] border-0 cursor-pointer bg-transparent text-[#5A6B5E] hover:bg-[#F7F3EA]"
                onClick={() => {
                  onChange("");
                  setQ("");
                  setOpen(false);
                }}
              >
                {allLabel}
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[#98a2b3]">{emptyHint}</div>
            ) : (
              <>
                {visibleOpts.map((o) => {
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={`w-full px-3 py-2.5 text-left text-[13px] border-0 cursor-pointer ${
                        on
                          ? "font-semibold"
                          : "bg-transparent text-[#1F3A24] hover:bg-[#F7F3EA]"
                      } ${uppercase ? "uppercase" : ""}`}
                      style={on ? { background: "#E8EFE4", color: ACCENT } : undefined}
                      onClick={() => {
                        onChange(o.value);
                        setQ("");
                        setOpen(false);
                        setListExpanded(false);
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-[12.5px] font-semibold border-0 cursor-pointer bg-[#F7F3EA] text-[#3D6B3A] hover:bg-[#E8EFE4]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setListExpanded(true);
                    }}
                  >
                    Mở rộng (+{hiddenCount})
                  </button>
                ) : null}
                {maxVisibleOptions && listExpanded && filtered.length > maxVisibleOptions ? (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-[12.5px] font-semibold border-0 cursor-pointer bg-[#F7F3EA] text-[#3D6B3A] hover:bg-[#E8EFE4]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setListExpanded(false);
                    }}
                  >
                    Thu gọn
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterSearchSelect;
