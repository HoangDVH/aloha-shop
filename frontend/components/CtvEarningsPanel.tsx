"use client";

import { useEffect, useState } from "react";
import { shopApiBase } from "@/lib/api";

type Stats = {
  ctvCode: string;
  held: { amount: number; count: number };
  eligible: { amount: number; count: number };
  billed: { amount: number; count: number };
  paidOut: { amount: number; count: number };
};

type BillRow = {
  period: string;
  billStatus: string;
  net: number;
  orderCount: number;
  paidAt: string | null;
};

type CommRow = {
  id: string;
  orderCode: string;
  ma: string;
  productName?: string;
  imageUrl?: string;
  unitPrice?: number;
  giaWeb?: number;
  qty?: number;
  amount: number;
  status: string;
  eligibleAt?: string;
  rate?: number;
};

function formatVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

function statusLabel(s: string) {
  switch (s) {
    case "held":
      return "Đang giữ (chờ hết đổi trả)";
    case "eligible":
      return "Đủ điều kiện";
    case "billed":
      return "Đã vào kỳ tháng";
    case "paid_out":
      return "Đã chi";
    case "cancelled":
      return "Đã hủy";
    case "flagged":
      return "Cần xem";
    default:
      return s;
  }
}

async function ctvFetch<T>(path: string): Promise<T> {
  const base = shopApiBase();
  const res = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export function CtvEarningsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [rows, setRows] = useState<CommRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr("");
      try {
        const [s, b, c] = await Promise.all([
          ctvFetch<{ ok: boolean } & Stats>("/api/shop/ctv/me/stats"),
          ctvFetch<{ data: BillRow[] }>("/api/shop/ctv/me/bills"),
          ctvFetch<{ data: CommRow[] }>("/api/shop/ctv/me/commissions?limit=30"),
        ]);
        if (cancelled) return;
        setStats(s);
        setBills(b.data || []);
        setRows(c.data || []);
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message || "Không tải được";
          if (msg === "ctv_not_active" || msg === "not_ctv") {
            setErr("Tài khoản CTV chưa được duyệt hoặc chưa kích hoạt.");
          } else setErr(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Đang tải hoa hồng…</p>;
  }
  if (err) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        {err}
      </p>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Mã CTV của bạn: <span className="font-extrabold text-[#1a2e1a]">{stats.ctvCode}</span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Đang giữ", amount: stats.held.amount, hint: `${stats.held.count} dòng` },
          {
            label: "Đủ điều kiện",
            amount: stats.eligible.amount,
            hint: `${stats.eligible.count} dòng`,
          },
          {
            label: "Trong kỳ tháng",
            amount: stats.billed.amount,
            hint: `${stats.billed.count} dòng`,
          },
          {
            label: "Đã nhận",
            amount: stats.paidOut.amount,
            hint: `${stats.paidOut.count} dòng`,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl bg-[#F7F3EA] px-3 py-3 ring-1 ring-[#E8E2D6]"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className="mt-1 text-lg font-black text-[#1a2e1a]">{formatVnd(c.amount)}</div>
            <div className="text-[11px] text-slate-500">{c.hint}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6]">
        <h3 className="mb-3 text-sm font-extrabold text-[#1a2e1a]">Kỳ tháng của tôi</h3>
        {!bills.length ? (
          <p className="text-sm text-slate-500">Chưa có kỳ đối soát.</p>
        ) : (
          <ul className="divide-y divide-[#E5DFD2]">
            {bills.map((b) => (
              <li key={b.period} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-bold">{b.period}</span>
                  <span className="ml-2 text-slate-500">
                    {b.billStatus === "paid" || b.paidAt
                      ? "Đã nhận tiền"
                      : b.billStatus === "locked"
                        ? "Đã chốt — chờ chuyển"
                        : b.billStatus}
                    · {b.orderCount} đơn
                  </span>
                </span>
                <span className="font-extrabold text-[var(--aloha-green)]">{formatVnd(b.net)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6]">
        <h3 className="mb-3 text-sm font-extrabold text-[#1a2e1a]">Dòng hoa hồng gần đây</h3>
        {!rows.length ? (
          <p className="text-sm text-slate-500">Chưa có dòng nào.</p>
        ) : (
          <ul className="divide-y divide-[#E5DFD2]">
            {rows.map((r) => {
              const gia = Number(r.unitPrice ?? r.giaWeb) || 0;
              return (
                <li key={r.id} className="flex gap-3 py-3 text-sm">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-[#E8E2D6]"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#F7F3EA] text-[10px] font-bold text-slate-400">
                      {r.ma.slice(0, 4)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold text-[#1a2e1a]">
                      {r.productName || r.ma}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {r.orderCode} · {r.ma}
                      {r.qty != null ? ` · ×${r.qty}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Giá web:{" "}
                      <span className="font-bold text-[#1a2e1a]">{formatVnd(gia)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {statusLabel(r.status)}
                      {r.rate != null ? ` · ${r.rate}%` : ""}
                      {r.eligibleAt
                        ? ` · đủ ĐK ${(r.eligibleAt || "").slice(0, 10)}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Hoa hồng
                    </p>
                    <p className="text-base font-extrabold text-[var(--aloha-green)]">
                      {formatVnd(r.amount)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
