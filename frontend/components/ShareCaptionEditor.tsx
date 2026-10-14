"use client";
import { useId } from "react";

export function ShareCaptionEditor({ value, onChange, onReset, loading = false }: {
  value: string; onChange: (value: string) => void; onReset: () => void; loading?: boolean;
}) {
  const id = useId();
  return <div className="mt-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-semibold">Nội dung chia sẻ</label>
      <button type="button" onClick={onReset} disabled={loading} className="text-xs font-semibold text-emerald-700 disabled:opacity-50">Khôi phục nội dung</button>
    </div>
    <textarea id={id} value={value} onChange={e => onChange(e.target.value)} rows={8} maxLength={6000}
      disabled={loading} className="w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-sm leading-relaxed outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-stone-50" />
    <p className="mt-1 text-xs leading-relaxed text-stone-500">{loading ? "Đang cập nhật giá và ưu đãi công khai…" : "Bạn có thể chỉnh nội dung trước khi chia sẻ. Giá và ưu đãi được xác nhận tại thời điểm đặt hàng."}</p>
  </div>;
}
