"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/admin/toast";
import { api, currentPeriod, formatVnd } from "./api";

export function KyThang({ onDone }: { onDone: () => void }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [bill, setBill] = useState<any>(null);
  const [eligible, setEligible] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        api<{ bill: any }>(`/api/shop/admin/ctv/bills?period=${encodeURIComponent(period)}`),
        api<{ data: any[]; sums: any }>("/api/shop/admin/ctv/commissions?status=eligible&limit=30"),
      ]);
      setBill(b.bill);
      setEligible(c.data || []);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthBase = /^(\d{4}-\d{2})/.exec(period)?.[1] || period;
  const cycle = /^(\d{4}-\d{2})-(K[12])$/.exec(period)?.[2] || "ALL";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="month"
          value={monthBase}
          onChange={(e) => {
            const newMonth = e.target.value;
            if (newMonth) {
              setPeriod(cycle === "ALL" ? newMonth : `${newMonth}-${cycle}`);
            }
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
        />
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
        >
          <option value={`${monthBase}-K1`}>Đợt 1 (01–15) · {monthBase}-K1</option>
          <option value={`${monthBase}-K2`}>Đợt 2 (16–hết) · {monthBase}-K2</option>
          <option value={monthBase}>Cả tháng · {monthBase}</option>
        </select>
        <button
          type="button"
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
          onClick={async () => {
            const ok = window.confirm(`Chốt kỳ ${period}? Không sửa lung tung sau khi chốt.`);
            if (!ok) return;
            try {
              const r = await api<{ bill: any }>("/api/shop/admin/ctv/bills/lock", {
                method: "POST",
                body: JSON.stringify({ period }),
              });
              setBill(r.bill);
              toast.success("Đã chốt kỳ");
              onDone();
              void load();
            } catch (e: any) {
              toast.error(e?.message || "Chốt thất bại");
            }
          }}
        >
          Chốt kỳ ({period})
        </button>
        {bill?.status === "locked" ? (
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white"
            onClick={async () => {
              const ok = window.confirm(`Đánh dấu đã chuyển tiền cả kỳ ${period}?`);
              if (!ok) return;
              try {
                await api(`/api/shop/admin/ctv/bills/${encodeURIComponent(period)}/mark-paid`, {
                  method: "POST",
                  body: JSON.stringify({}),
                });
                toast.success("Đã đánh dấu chi");
                onDone();
                void load();
              } catch (e: any) {
                toast.error(e?.message || "Lỗi");
              }
            }}
          >
            Đánh dấu đã chuyển tiền (cả kỳ)
          </button>
        ) : null}
      </div>

      {bill ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="font-bold text-slate-800">
            Bill {bill.period} ·{" "}
            {bill.status === "locked"
              ? "Đã chốt"
              : bill.status === "paid"
                ? "Đã chi"
                : bill.status}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Tổng hoa hồng: <b>{formatVnd(bill.totals?.commission || 0)}</b> ·{" "}
            {bill.totals?.ctvCount || 0} cộng tác viên · {bill.totals?.lineCount || 0}{" "}
            dòng
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(bill.ctvLines || []).map((l: any) => (
              <div
                key={l.ctvCode}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <b>{l.ctvCode}</b> · {l.orderCount} đơn · {formatVnd(l.net)}
                  {l.paidAt ? " · đã chi" : ""}
                </span>
                {bill.status === "locked" && !l.paidAt ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold"
                    onClick={async () => {
                      await api(
                        `/api/shop/admin/ctv/bills/${encodeURIComponent(period)}/mark-paid`,
                        {
                          method: "POST",
                          body: JSON.stringify({ ctvCode: l.ctvCode }),
                        }
                      );
                      toast.success(`Đã chi ${l.ctvCode}`);
                      void load();
                      onDone();
                    }}
                  >
                    Chi CTV này
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chưa có bill kỳ này — có thể chốt khi đủ dòng.</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-slate-800">Chưa vào kỳ (đủ điều kiện)</h3>
        <div className="flex flex-col gap-1.5">
          {eligible.map((r) => (
            <div
              key={r.id}
              className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs"
            >
              <span>
                {r.displayOrderCode || r.orderCode} · {r.ma} · {r.ctvCode}
              </span>
              <b>{formatVnd(r.amount)}</b>
            </div>
          ))}
          {!eligible.length ? (
            <p className="text-xs text-slate-400">Không có dòng đủ điều kiện.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
