"use client";
import { numberText, rate, type Funnel } from "@/lib/businessOverview";

export function ConversionOverview({ data, compare, previousStart }: { data?: Funnel & { previous: Funnel }; compare: boolean; previousStart?: string }) {
  const conversion = data ? rate(data.placed, data.visits) : null;
  const prior = data ? rate(data.previous.placed, data.previous.visits) : null;
  const completePrior = Boolean(previousStart && data?.trackingSince && new Date(data.trackingSince) <= new Date(`${previousStart}T00:00:00+07:00`));
  const steps = [{ key: "visits" as const, label: "Truy cập", color: "bg-emerald-200" },
    { key: "cart" as const, label: "Thêm vào giỏ", color: "bg-emerald-300" },
    { key: "checkout" as const, label: "Bắt đầu thanh toán", color: "bg-emerald-400" },
    { key: "placed" as const, label: "Đặt hàng thành công", color: "bg-[#2D5A27]" }];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Chuyển đổi mua hàng">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-bold text-slate-900">Chuyển đổi mua hàng</h2><p className="mt-1 text-sm text-slate-500">Truy cập → Thêm giỏ → Thanh toán → Đặt thành công</p></div>
      <div className="sm:text-right"><p className="text-xs font-medium text-slate-500">Tỷ lệ chuyển đổi chung</p>
        <strong className="text-3xl font-semibold text-[#2D5A27]">{conversion === null ? "—" : `${numberText(conversion)}%`}</strong>
        {data && data.visits > 0 && data.visits < 30 && <p className="mt-1 text-xs text-amber-700">Dữ liệu còn ít: {numberText(data.visits)} phiên</p>}
        {compare && <p className="mt-1 text-xs text-slate-500">
          {conversion !== null && prior !== null && completePrior ? `${conversion > prior ? "↑" : conversion < prior ? "↓" : "="} ${numberText(Math.abs(conversion - prior))} điểm % so với kỳ trước` : "Chưa đủ dữ liệu kỳ trước để so sánh"}
        </p>}
      </div>
    </div>
    {data && !data.trackingSince ? <div className="mt-5 rounded-xl bg-[#EAF3E8] p-5 text-sm font-medium text-[#2D5A27]">Chưa có dữ liệu chuyển đổi. Số liệu sẽ xuất hiện khi có lượt truy cập mới sau khi bật tracking.</div>
      : <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const value = data?.[step.key];
          const percent = value !== undefined && data ? rate(value, data.visits) : null;
          const nextValue = i < steps.length - 1 ? data?.[steps[i + 1].key] : undefined;
          const continued = nextValue !== undefined && value !== undefined ? rate(nextValue, value) : null;
          return <li key={step.key} className="min-w-0 rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-700"><span className="mr-2 text-xs text-slate-400">0{i + 1}</span>{step.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value === undefined ? "—" : numberText(value)} <span className="text-xs font-normal text-slate-500">phiên</span></p>
            <p className="mt-1 text-xs text-slate-500">{percent === null ? "—" : `${numberText(percent)}%`} trên tổng truy cập</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${step.color}`} style={{ width: `${Math.min(100, percent ?? 0)}%` }} /></div>
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5">
              {i === steps.length - 1 ? <span className="font-semibold text-[#2D5A27]">Hoàn tất đủ 4 bước trong phiên</span>
                : <><p className="font-semibold text-[#2D5A27]">Tiếp tục {continued === null ? "—" : `${numberText(continued)}%`} →</p><p className="text-slate-500">Chưa tiếp tục: {value === undefined || nextValue === undefined ? "—" : numberText(Math.max(0, value - nextValue))} phiên</p></>}
            </div>
          </li>;
        })}
      </ol>}
    <div className="mt-5 flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
      <p>{data?.trackingSince ? `Có dữ liệu từ ${new Date(data.trackingSince).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.` : "Chỉ thống kê hoạt động trên website shop."}</p>
      <details className="max-w-xl"><summary className="cursor-pointer font-semibold text-[#2D5A27] hover:underline">ⓘ Cách tính phễu</summary>
        <p className="mt-2 leading-5">Chỉ tính phiên đi qua các bước đúng thứ tự. Mỗi phiên tính một lần ở mỗi bước. Tỷ lệ chung = phiên hoàn tất đủ 4 bước / tổng phiên. Giỏ lưu từ phiên trước không được tính là thêm giỏ trong phiên mới. Đặt thành công gồm COD chưa giao; không tính đơn test. “Chưa tiếp tục” gồm cả phiên còn đang mua, không đồng nghĩa đơn hủy. Nhãn dữ liệu ít xuất hiện khi có dưới 30 phiên.</p>
      </details>
    </div>
    {data?.trackingSince && data.visits === 0 && <p className="mt-2 text-sm text-slate-500">Chưa có phiên được ghi nhận trong khoảng ngày chọn.</p>}
  </section>;
}
