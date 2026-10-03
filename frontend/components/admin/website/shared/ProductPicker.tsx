"use client";

import { useEffect, useState } from "react";
import { websiteApi } from "../api";
import { wbInput } from "../ui";

export type PickedProduct = {
  ma: string;
  ten: string;
  anh?: string;
  giaBan?: number;
  giaVon?: number;
  ton?: number;
};

type Props = {
  onPick: (product: PickedProduct) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Chỉ gợi ý sản phẩm đang hiện trên web (mặc định bật). */
  visibleOnly?: boolean;
  limit?: number;
  className?: string;
};

/** Ô tìm sản phẩm theo mã / tên, hiện danh sách gợi ý; chọn xong tự xoá ô tìm. */
export function ProductPicker({
  onPick,
  placeholder = "Gõ mã hoặc tên SP…",
  disabled,
  visibleOnly = true,
  limit = 8,
  className = "",
}: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedProduct[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (!term || disabled) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      const params = new URLSearchParams({ page: "1", limit: String(limit), q: term });
      if (visibleOnly) params.set("visible", "1");
      void websiteApi<{ items: PickedProduct[] }>(`/api/shop/admin/products?${params}`)
        .then((r) => {
          if (!cancelled) setItems(r.items || []);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, disabled, visibleOnly, limit]);

  return (
    <div className={`relative ${className}`}>
      <input
        className={wbInput}
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
      />
      {items.length ? (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {items.map((p) => (
            <li key={p.ma}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                onClick={() => {
                  onPick(p);
                  setQ("");
                  setItems([]);
                }}
              >
                <span className="font-semibold text-[#0F9D58]">{p.ma}</span>
                <span className="truncate text-gray-600">{p.ten}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
