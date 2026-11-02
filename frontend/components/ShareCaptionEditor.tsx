"use client";
import { useId } from "react";

export function ShareCaptionEditor({
  value,
  onChange,
  onReset,
  loading = false,
  hideHeader = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  loading?: boolean;
  hideHeader?: boolean;
}) {
  const id = useId();
  return (
    <div className={hideHeader ? "mt-1.5" : "mt-4"}>
      {!hideHeader && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor={id} className="text-sm font-semibold">
            Nội dung chia sẻ
          </label>
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="text-xs font-semibold text-emerald-700 disabled:opacity-50"
          >
            Khôi phục nội dung
          </button>
        </div>
      )}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        maxLength={6000}
        disabled={loading}
        className="w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-stone-50 shadow-2xs"
      />
      <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
        {loading
          ? "Đang cập nhật giá và ưu đãi…"
          : "Bạn có thể chỉnh sửa nội dung trước khi chia sẻ. Giá và ưu đãi được xác nhận tại thời điểm đặt hàng."}
      </p>
    </div>
  );
}
