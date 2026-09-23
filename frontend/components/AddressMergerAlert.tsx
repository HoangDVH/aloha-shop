"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import {
  findAddressMergerSuggestion,
  type AddressMergerSuggest,
} from "@/lib/addressMerger";

type Props = {
  province?: string;
  district?: string;
  ward?: string;
  detail?: string;
  onApply: (suggest: AddressMergerSuggest) => void;
  className?: string;
};

/**
 * Hiển thị thông báo gợi ý đổi địa chỉ cũ sang địa chỉ mới sau sáp nhập
 * theo giao diện chuẩn (icon bóng đèn, nội dung thay đổi và nút Đổi địa chỉ).
 */
export function AddressMergerAlert({
  province = "",
  district = "",
  ward = "",
  detail = "",
  onApply,
  className = "",
}: Props) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const suggestion = useMemo(() => {
    const s = findAddressMergerSuggestion({ province, district, ward, detail });
    if (!s || s.id === dismissedId) return null;
    return s;
  }, [province, district, ward, detail, dismissedId]);

  if (!suggestion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 sm:p-4 text-sm text-slate-800 shadow-sm transition-all ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <Lightbulb size={20} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="leading-relaxed">
          <p>Địa chỉ trên đã thay đổi sau khi sáp nhập ngày {suggestion.effectiveDate}.</p>
          <p className="mt-0.5">
            Bạn có muốn đổi thành địa chỉ mới:{" "}
            <strong className="font-semibold text-slate-900">
              {suggestion.suggest.displayText}
            </strong>
            ?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={() => {
            onApply(suggestion.suggest);
            setDismissedId(suggestion.id);
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-500 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-blue-600 shadow-xs transition hover:bg-blue-50 hover:text-blue-700 active:scale-95"
        >
          Đổi địa chỉ
        </button>
      </div>
    </div>
  );
}
