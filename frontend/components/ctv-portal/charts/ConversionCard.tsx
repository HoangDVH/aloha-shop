"use client";

import { Empty } from "antd";

export function ConversionCard({ clicks, orders }: { clicks: number; orders: number }) {
  if (clicks <= 0 && orders <= 0) {
    return <Empty description="Chưa có click / đơn trong kỳ" />;
  }

  const ratio = clicks > 0 ? orders / clicks : null;
  const pct = ratio != null ? ratio * 100 : null;
  const displayPct = pct == null ? 0 : pct;
  // Vòng tròn: phần đã chuyển đổi vs phần còn lại (không dùng 2 xanh gần nhau)
  const convertedShare = Math.min(100, Math.max(0, displayPct));
  const size = 152;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (convertedShare / 100) * circ;
  const maxBar = Math.max(clicks, orders, 1);

  return (
    <div className="flex h-full flex-col items-stretch justify-center gap-5">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* phần chưa chuyển đổi — xám trung tính */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#E5E9E8"
              strokeWidth={stroke}
            />
            {/* phần đã chuyển đổi — xanh đậm */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#2D5A27"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-[24px] font-extrabold tracking-tight text-[#1a2e1a]">
              {pct == null ? "—" : `${displayPct.toFixed(1)}%`}
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              Click → Đơn
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#94A3B8]" />
                Click
              </span>
              <span className="font-extrabold tabular-nums text-[#1a2e1a]">
                {clicks.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF1F4]">
              <div
                className="h-full rounded-full bg-[#94A3B8]"
                style={{ width: `${(clicks / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#2D5A27]" />
                Đơn hàng
              </span>
              <span className="font-extrabold tabular-nums text-[#1a2e1a]">
                {orders.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF1F4]">
              <div
                className="h-full rounded-full bg-[#2D5A27]"
                style={{ width: `${(orders / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-[#F3F7F2] px-2.5 py-2 text-[12px]">
            <span className="font-semibold text-slate-500">Tỷ lệ </span>
            <span className="font-extrabold text-[#2D5A27]">
              {pct == null ? "—" : `${displayPct.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2D5A27]" />
          Đã chuyển đổi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E9E8]" />
          Chưa chuyển đổi
        </span>
      </div>

      {pct != null && pct > 100 ? (
        <p className="mb-0 text-[11px] leading-snug text-amber-700">
          Trên 100% vì có đơn gắn CTV dù không/ít click trong kỳ.
        </p>
      ) : null}
    </div>
  );

}
