"use client";
import { numberText, rate, type Funnel } from "@/lib/businessOverview";

export function ConversionOverview({ data, compare, previousStart }: { data?: Funnel & { previous: Funnel }; compare: boolean; previousStart?: string }) {
  const conversion = data ? rate(data.placed, data.visits) : null;
  const prior = data ? rate(data.previous.placed, data.previous.visits) : null;
  const completePrior = Boolean(previousStart && data?.trackingSince && new Date(data.trackingSince) <= new Date(`${previousStart}T00:00:00+07:00`));
  const steps = [{ key: "visits" as const, label: "Truy cập", color: "bg-blue-100" },
    { key: "cart" as const, label: "Thêm vào giỏ", color: "bg-blue-200" },
    { key: "checkout" as const, label: "Bắt đầu thanh toán", color: "bg-blue-400" },
    { key: "placed" as const, label: "Đặt hàng thành công", color: "bg-blue-600" }];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Chuyển đổi mua hàng">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-bold text-slate-900">Chuyển đổi mua hàng</h2><p className="mt-1 text-sm text-slate-500">Từ lượt ghé shop đến đặt hàng thành công</p></div>
      <div className="sm:text-right"><p className="text-xs font-medium text-slate-500">Tỷ lệ chuyển đổi chung</p>
        <strong className="text-3xl font-semibold text-blue-600">{conversion === null ? "—" : `${numberText(conversion)}%`}</strong>
        {compare && <p className={`mt-1 text-xs ${conversion !== null && prior !== null && completePrior && conversion > prior ? "text-emerald-600" : "text-slate-500"}`}>
          {conversion !== null && prior !== null && completePrior ? `${conversion >= prior ? "↑" : "↓"} ${numberText(Math.abs(conversion - prior))} điểm % so với kỳ trước` : "Chưa đủ dữ liệu kỳ trước để so sánh"}
        </p>}
      </div>
    </div>
    {data && !data.trackingSince ? <div className="mt-5 rounded-xl bg-blue-50 p-5 text-sm text-blue-900">Chưa có dữ liệu chuyển đổi. Số liệu sẽ xuất hiện khi có lượt truy cập mới sau khi bật tracking.</div>
      : <ol className="mt-6 grid gap-5 lg:grid-cols-4">
        {steps.map((step, i) => {
          const value = data?.[step.key], prev = i ? data?.[steps[i - 1].key] : undefined;
          const percent = value !== undefined && data ? rate(value, data.visits) : null;
          const transitioned = data && step.key !== "visits" ? data.transitions[step.key] : undefined;
          const next = transitioned !== undefined && prev !== undefined ? rate(transitioned, prev) : null;
          return <li key={step.key} className="min-w-0">
            <p className="text-sm font-medium text-slate-700"><span className="mr-2 text-xs text-slate-400">0{i + 1}</span>{step.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value === undefined ? "—" : numberText(value)} <span className="text-xs font-normal text-slate-500">phiên</span></p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${step.color}`} style={{ width: `${Math.min(100, percent ?? 0)}%` }} /></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{i === 0 ? "Tổng phiên trong kỳ" : next === null ? "Chưa có tỷ lệ bước trước" : `${numberText(next)}% phiên ở bước trước cũng đạt bước này`}</p>
          </li>;
        })}
      </ol>}
    <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
      Tỷ lệ chung = phiên có đơn đặt thành công / tổng phiên. Mỗi bước đếm một lần mỗi phiên; giỏ lưu sẵn có thể bỏ qua bước thêm giỏ.
      Đặt thành công gồm COD chưa giao, khác với đơn hoàn thành ở phần doanh thu. Không tính đơn test.
      {data?.trackingSince && ` Có dữ liệu từ ${new Date(data.trackingSince).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`}
    </p>
    {data?.trackingSince && data.visits === 0 && <p className="mt-2 text-sm text-slate-500">Chưa có phiên được ghi nhận trong khoảng ngày chọn.</p>}
  </section>;
}
