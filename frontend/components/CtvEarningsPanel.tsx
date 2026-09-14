"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shopApiBase } from "@/lib/api";

type SubTab = "tong-quan" | "chuyen-doi" | "thanh-toan";

type Stats = {
  ctvCode: string;
  returnHoldDays?: number;
  held: { amount: number; count: number };
  eligible: { amount: number; count: number };
  billed: { amount: number; count: number };
  paidOut: { amount: number; count: number };
  pendingOrders?: { count: number; amount: number };
};

type BillRow = {
  period: string;
  billStatus: string;
  net: number;
  gross?: number;
  orderCount: number;
  paidAt: string | null;
  lockedAt?: string | null;
};

type Overview = {
  from: string;
  to: string;
  metrics: {
    clicks: number;
    orders: number;
    qtySold: number;
    gmv: number;
    estimatedCommission: number;
    buyers: number;
  };
};

type ConversionRow = {
  orderCode: string;
  purchasedAt: string | null;
  clickAt: string | null;
  completedAt: string | null;
  orderStatus: string;
  orderLabel: string;
  payLabel: string;
  paymentStatus: string;
  total: number;
  itemCommission: number;
  totalCommission: number;
  buyerStatus: string;
  productSummary: string;
  commissionStatus: string;
};

const PAGE_SIZE = 10;

function formatVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

function formatMoneyCompact(n: number) {
  const v = Math.round(n || 0);
  if (v >= 1_000_000_000)
    return `${(v / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ đồng`;
  if (v >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu đồng`;
  if (v >= 10_000)
    return `${(v / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k đồng`;
  return `${v.toLocaleString("vi-VN")} đồng`;
}

function formatCompact(n: number) {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tỷ`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (n >= 10_000)
    return `${(n / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString("vi-VN");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthRange(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    from: ymd(start),
    to: ymd(end),
    label: `${pad2(start.getDate())}-${pad2(start.getMonth() + 1)}-${start.getFullYear()} - ${pad2(end.getDate())}-${pad2(end.getMonth() + 1)}-${end.getFullYear()}`,
  };
}

function formatDt(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) {
    const s = String(v);
    return s.length >= 16 ? s.slice(0, 16).replace("T", " ") : s.slice(0, 10);
  }
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatPeriodLabel(period: string) {
  // period dạng YYYY-MM
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0);
  return {
    title: `Tháng ${mo} ${y}`,
    range: `${pad2(start.getDate())}/${pad2(mo)}/${y} – ${pad2(end.getDate())}/${pad2(mo)}/${y}`,
  };
}

async function ctvFetch<T>(path: string): Promise<T> {
  const base = shopApiBase();
  const res = await fetch(`${base}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const body = [headers.map(esc).join(",")]
    .concat(rows.map((r) => r.map(esc).join(",")))
    .join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CtvEarningsPanel() {
  const initialRange = monthRange(0);
  const [subTab, setSubTab] = useState<SubTab>("tong-quan");
  const [stats, setStats] = useState<Stats | null>(null);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(false);
  const [range, setRange] = useState(initialRange);
  const [payRange, setPayRange] = useState(initialRange);
  const [liveAt, setLiveAt] = useState(0);
  const [page, setPage] = useState(1);
  const [billDetail, setBillDetail] = useState<BillRow | null>(null);

  // Conversion filters
  const [fFrom, setFFrom] = useState(initialRange.from);
  const [fTo, setFTo] = useState(initialRange.to);
  const [fOrderCode, setFOrderCode] = useState("");
  const [fOrderStatus, setFOrderStatus] = useState("all");
  const [fPayStatus, setFPayStatus] = useState("all");

  const loadCore = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setErr("");
      try {
        const [s, b, o] = await Promise.all([
          ctvFetch<{ ok: boolean } & Stats>("/api/shop/ctv/me/stats"),
          ctvFetch<{ data: BillRow[] }>("/api/shop/ctv/me/bills"),
          ctvFetch<Overview>(
            `/api/shop/ctv/me/overview?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
          ),
        ]);
        setStats(s);
        setBills(b.data || []);
        setOverview(o);
        setLiveAt(Date.now());
      } catch (e: any) {
        const msg = e?.message || "Không tải được";
        if (msg === "ctv_not_active" || msg === "not_ctv") {
          setErr("Tài khoản CTV chưa được duyệt hoặc chưa kích hoạt.");
        } else setErr(msg);
      } finally {
        setLoading(false);
      }
    },
    [range.from, range.to]
  );

  const loadConversions = useCallback(async () => {
    setConvLoading(true);
    try {
      const qs = new URLSearchParams({
        from: fFrom,
        to: fTo,
      });
      if (fOrderCode.trim()) qs.set("orderCode", fOrderCode.trim());
      if (fOrderStatus !== "all") qs.set("orderStatus", fOrderStatus);
      if (fPayStatus !== "all") qs.set("paymentStatus", fPayStatus);
      const r = await ctvFetch<{ data: ConversionRow[] }>(
        `/api/shop/ctv/me/conversions?${qs.toString()}`
      );
      setConversions(r.data || []);
      setPage(1);
    } catch (e: any) {
      setErr(e?.message || "Không tải báo cáo chuyển đổi");
    } finally {
      setConvLoading(false);
    }
  }, [fFrom, fTo, fOrderCode, fOrderStatus, fPayStatus]);

  useEffect(() => {
    void loadCore(false);
  }, [loadCore]);

  useEffect(() => {
    if (subTab === "chuyen-doi") void loadConversions();
  }, [subTab, loadConversions]);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible")
        return;
      void loadCore(true);
      if (subTab === "chuyen-doi") void loadConversions();
    };
    const id = window.setInterval(tick, 15_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadCore, loadConversions, subTab]);

  const holdDays = stats?.returnHoldDays ?? 7;
  const waitPayoutAmount =
    (stats?.eligible.amount || 0) + (stats?.billed.amount || 0);
  const waitPayoutCount =
    (stats?.eligible.count || 0) + (stats?.billed.count || 0);

  const statusCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        key: "pending",
        label: "Chờ hoàn tất đơn",
        value: formatVnd(stats.pendingOrders?.amount || 0),
        explain: "Chưa phát sinh hoa hồng",
        hint: `${stats.pendingOrders?.count || 0} đơn · chưa giao / chưa thanh toán xong`,
        count: stats.pendingOrders?.count || 0,
      },
      {
        key: "held",
        label: "Tạm giữ sau giao",
        value: formatVnd(stats.held.amount),
        explain: "Đã giao — chưa chi",
        hint: `${stats.held.count} dòng · chờ hết ${holdDays} ngày đổi trả`,
        count: stats.held.count,
      },
      {
        key: "payout",
        label: "Chờ nhận tiền",
        value: formatVnd(waitPayoutAmount),
        explain: "Sắp được chuyển",
        hint: `${waitPayoutCount} dòng · đủ ĐK / kỳ tháng`,
        count: waitPayoutCount,
      },
      {
        key: "paid",
        label: "Đã nhận",
        value: formatVnd(stats.paidOut.amount),
        explain: "Hoàn tất",
        hint: `${stats.paidOut.count} dòng · shop đã chuyển`,
        count: stats.paidOut.count,
      },
    ].filter((c) => c.count > 0);
  }, [stats, holdDays, waitPayoutAmount, waitPayoutCount]);

  const overviewCards = useMemo(() => {
    const m = overview?.metrics;
    if (!m) return [];
    return [
      { label: "Số lần nhấp chuột", value: formatCompact(m.clicks) },
      { label: "Đơn hàng", value: formatCompact(m.orders) },
      { label: "Số lượng đã bán", value: formatCompact(m.qtySold) },
      { label: "Doanh số", value: formatMoneyCompact(m.gmv) },
      {
        label: "Hoa hồng ước tính",
        value: formatMoneyCompact(m.estimatedCommission),
      },
      { label: "Người mua", value: formatCompact(m.buyers) },
    ];
  }, [overview]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // period YYYY-MM so sánh với payRange
      if (!b.period) return true;
      const [y, m] = b.period.split("-").map(Number);
      if (!y || !m) return true;
      const pStart = `${y}-${pad2(m)}-01`;
      const pEnd = ymd(new Date(y, m, 0));
      return pEnd >= payRange.from && pStart <= payRange.to;
    });
  }, [bills, payRange.from, payRange.to]);

  const totalPaidOut = useMemo(
    () =>
      filteredBills
        .filter((b) => b.billStatus === "paid" || b.paidAt)
        .reduce((s, b) => s + (b.net || 0), 0),
    [filteredBills]
  );
  const totalLocked = useMemo(
    () =>
      filteredBills
        .filter((b) => b.billStatus === "locked" && !b.paidAt)
        .reduce((s, b) => s + (b.net || 0), 0),
    [filteredBills]
  );

  const totalPages = Math.max(1, Math.ceil(conversions.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = conversions.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE
  );

  function resetConversionFilters() {
    const r = monthRange(0);
    setFFrom(r.from);
    setFTo(r.to);
    setFOrderCode("");
    setFOrderStatus("all");
    setFPayStatus("all");
  }

  function doExport() {
    exportCsv(
      `bao-cao-chuyen-doi-${fFrom}_${fTo}.csv`,
      [
        "Thời gian click",
        "Thời gian mua",
        "Mã đơn",
        "Trạng thái đơn",
        "Thanh toán",
        "Hoàn thành",
        "HH item",
        "Tổng HH",
        "Trạng thái HH",
        "Người mua",
        "Sản phẩm",
      ],
      conversions.map((r) => [
        formatDt(r.clickAt),
        formatDt(r.purchasedAt),
        r.orderCode,
        r.orderLabel,
        r.payLabel,
        formatDt(r.completedAt),
        String(Math.round(r.itemCommission || 0)),
        String(Math.round(r.totalCommission || 0)),
        r.commissionStatus,
        r.buyerStatus,
        r.productSummary,
      ])
    );
  }

  if (loading && !stats) {
    return <p className="text-sm text-slate-500">Đang tải hoa hồng…</p>;
  }
  if (err && !stats) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        {err}
      </p>
    );
  }
  if (!stats) return null;

  const tabs: { id: SubTab; label: string }[] = [
    { id: "tong-quan", label: "Tổng quan" },
    { id: "chuyen-doi", label: "Báo cáo chuyển đổi" },
    { id: "thanh-toan", label: "Thanh toán" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Mã CTV:{" "}
          <span className="font-extrabold text-[#1a2e1a]">{stats.ctvCode}</span>
          {liveAt ? (
            <span className="ml-2 text-[11px] text-emerald-700">
              · Đang cập nhật trực tiếp
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => {
            void loadCore(false);
            if (subTab === "chuyen-doi") void loadConversions();
          }}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-[#E8E2D6] hover:bg-[#F7F3EA]"
        >
          Làm mới
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#E8E2D6]">
        {tabs.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`-mb-px px-4 py-2.5 text-sm font-bold transition ${
                active
                  ? "border-b-2 border-[var(--aloha-green)] text-[var(--aloha-green)]"
                  : "text-slate-500 hover:text-[#1a2e1a]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ===== TỔNG QUAN (không click drill-down) ===== */}
      {subTab === "tong-quan" ? (
        <div className="space-y-5">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-[#1a2e1a]">
                Các chỉ số chính
              </h3>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold">Kỳ</span>
                <select
                  className="rounded-lg border border-[#E8E2D6] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1a2e1a]"
                  value={`${range.from}|${range.to}`}
                  onChange={(e) => {
                    const [from, to] = e.target.value.split("|");
                    const hit = [monthRange(0), monthRange(-1)].find(
                      (r) => r.from === from && r.to === to
                    );
                    setRange(hit || { from, to, label: `${from} - ${to}` });
                  }}
                >
                  {[monthRange(0), monthRange(-1)].map((r) => (
                    <option key={r.from} value={`${r.from}|${r.to}`}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {overviewCards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl border border-[#EEE8DC] bg-white px-3 py-3"
                >
                  <div className="text-[12px] font-medium text-slate-500">
                    {c.label}
                  </div>
                  <div className="mt-2 text-xl font-black tracking-tight text-[#1a2e1a] sm:text-2xl">
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Chỉ xem tổng quan — xem chi tiết đơn tại «Báo cáo chuyển đổi», xem
              nhận tiền tại «Thanh toán».
            </p>
          </section>

          {statusCards.length ? (
            <section>
              <h3 className="mb-2 text-sm font-extrabold text-[#1a2e1a]">
                Trạng thái đang có
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statusCards.map((c) => (
                  <div
                    key={c.key}
                    className="rounded-xl bg-[#FBF8F1] px-3 py-3 ring-1 ring-[#E8E2D6]"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      {c.label}
                    </div>
                    <div className="mt-1 text-lg font-black text-[#1a2e1a]">
                      {c.value}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[#2E7D32]">
                      {c.explain}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-slate-500">
                      {c.hint}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* ===== BÁO CÁO CHUYỂN ĐỔI ===== */}
      {subTab === "chuyen-doi" ? (
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6] sm:p-5">
            <h3 className="mb-4 text-base font-extrabold text-[#1a2e1a]">
              Báo cáo chuyển đổi
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-600">
                Thời gian mua hàng
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={fFrom}
                    onChange={(e) => setFFrom(e.target.value)}
                    className="w-full rounded-lg border border-[var(--aloha-line)] px-2.5 py-2 text-xs font-medium text-[var(--aloha-ink)] accent-[var(--aloha-green)] focus:border-[var(--aloha-green)] focus:outline-none focus:ring-1 focus:ring-[var(--aloha-green)]"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    value={fTo}
                    onChange={(e) => setFTo(e.target.value)}
                    className="w-full rounded-lg border border-[var(--aloha-line)] px-2.5 py-2 text-xs font-medium text-[var(--aloha-ink)] accent-[var(--aloha-green)] focus:border-[var(--aloha-green)] focus:outline-none focus:ring-1 focus:ring-[var(--aloha-green)]"
                  />
                </div>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Trạng thái đơn hàng
                <select
                  value={fOrderStatus}
                  onChange={(e) => setFOrderStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--aloha-line)] bg-white px-2.5 py-2 text-xs font-medium text-[var(--aloha-ink)] accent-[var(--aloha-green)] focus:border-[var(--aloha-green)] focus:outline-none focus:ring-1 focus:ring-[var(--aloha-green)]"
                >
                  <option value="all">Tất cả</option>
                  <option value="cho_xu_ly">Chờ xử lý</option>
                  <option value="cho_thanh_toan">Chờ thanh toán</option>
                  <option value="dang_giao">Đang giao</option>
                  <option value="hoan_thanh">Hoàn thành</option>
                  <option value="thieu_hang">Thiếu hàng</option>
                  <option value="huy">Đã hủy</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Trạng thái thanh toán
                <select
                  value={fPayStatus}
                  onChange={(e) => setFPayStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--aloha-line)] bg-white px-2.5 py-2 text-xs font-medium text-[var(--aloha-ink)] accent-[var(--aloha-green)] focus:border-[var(--aloha-green)] focus:outline-none focus:ring-1 focus:ring-[var(--aloha-green)]"
                >
                  <option value="all">Tất cả</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="cod">COD</option>
                  <option value="pending">Chưa thanh toán / chờ CK</option>
                  <option value="underpaid">Thiếu tiền CK</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-2">
                Mã đơn hàng
                <input
                  value={fOrderCode}
                  onChange={(e) => setFOrderCode(e.target.value)}
                  placeholder="Tìm theo mã đơn (vd. WEB-260907-…)"
                  className="mt-1 w-full rounded-lg border border-[var(--aloha-line)] bg-white px-2.5 py-2 text-xs font-medium text-[var(--aloha-ink)] focus:border-[var(--aloha-green)] focus:outline-none focus:ring-1 focus:ring-[var(--aloha-green)]"
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={resetConversionFilters}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[var(--aloha-ink)] ring-1 ring-[var(--aloha-line)] hover:bg-[var(--aloha-cream)]"
                >
                  Thiết lập lại
                </button>
                <button
                  type="button"
                  onClick={() => void loadConversions()}
                  className="rounded-lg bg-[var(--aloha-green)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--aloha-green-mid)]"
                >
                  Tìm kiếm
                </button>
                <button
                  type="button"
                  onClick={doExport}
                  disabled={!conversions.length}
                  className="rounded-lg bg-[var(--aloha-green-dark)] px-4 py-2 text-xs font-bold text-white hover:opacity-95 disabled:opacity-40"
                >
                  Xuất dữ liệu
                </button>
              </div>
            </div>
          </section>

          <div className="rounded-xl bg-[var(--aloha-green-light)] px-4 py-3 text-[12px] leading-relaxed text-[var(--aloha-ink)] ring-1 ring-[var(--aloha-line)]">
            Hoa hồng chỉ phát sinh sau khi đơn giao thành công. Đơn đang xử lý /
            COD chưa giao vẫn hiện trong báo cáo nhưng cột HH có thể = 0.
          </div>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E2D6]">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-left text-xs">
                <thead className="bg-[#FBF8F1] text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Thời gian click</th>
                    <th className="px-3 py-3">Thời gian mua</th>
                    <th className="px-3 py-3">Mã đơn</th>
                    <th className="px-3 py-3">Trạng thái đơn</th>
                    <th className="px-3 py-3">Hoàn thành</th>
                    <th className="px-3 py-3 text-right">HH (đ)</th>
                    <th className="px-3 py-3">Trạng thái HH</th>
                    <th className="px-3 py-3">Người mua</th>
                    <th className="px-3 py-3">Sản phẩm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9DD]">
                  {convLoading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        Đang tải…
                      </td>
                    </tr>
                  ) : !pageRows.length ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        Không có đơn trong bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.orderCode} className="hover:bg-[#FBF8F1]/60">
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          {formatDt(r.clickAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          {formatDt(r.purchasedAt)}
                        </td>
                        <td className="px-3 py-3 font-bold text-[#1a2e1a]">
                          {r.orderCode}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {r.orderLabel}
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {r.payLabel}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          {formatDt(r.completedAt)}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-[#1a2e1a]">
                          {formatVnd(r.totalCommission)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[11px] font-semibold text-slate-600">
                            {r.commissionStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {r.buyerStatus}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-3 text-slate-600">
                          {r.productSummary}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-[#EFE9DD] px-4 py-3">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-[#E8E2D6] disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="text-xs font-semibold text-slate-600">
                  Trang {pageSafe}/{totalPages} · {conversions.length} đơn
                </span>
                <button
                  type="button"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-[#E8E2D6] disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            ) : (
              <div className="border-t border-[#EFE9DD] px-4 py-2 text-[11px] text-slate-500">
                {conversions.length} đơn
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* ===== THANH TOÁN ===== */}
      {subTab === "thanh-toan" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-[#1a2e1a]">
              Lịch sử thanh toán
            </h3>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">Kỳ</span>
              <select
                className="rounded-lg border border-[#E8E2D6] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1a2e1a]"
                value={`${payRange.from}|${payRange.to}`}
                onChange={(e) => {
                  const [from, to] = e.target.value.split("|");
                  const hit = [monthRange(0), monthRange(-1), monthRange(-2)].find(
                    (r) => r.from === from && r.to === to
                  );
                  setPayRange(hit || { from, to, label: `${from} - ${to}` });
                }}
              >
                {[monthRange(0), monthRange(-1), monthRange(-2)].map((r) => (
                  <option key={r.from} value={`${r.from}|${r.to}`}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E8E2D6] sm:p-5">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Thu nhập của tôi
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Tổng số tiền đã thanh toán
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-[#1a2e1a]">
                  {formatVnd(totalPaidOut || stats.paidOut.amount)}
                </p>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Chi tiết thu nhập
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#FBF8F1] px-3 py-3 ring-1 ring-[#E8E2D6]">
                    <p className="text-[11px] font-semibold text-slate-500">
                      Đã nhận
                    </p>
                    <p className="mt-1 text-base font-extrabold text-[#1a2e1a]">
                      {formatVnd(stats.paidOut.amount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FBF8F1] px-3 py-3 ring-1 ring-[#E8E2D6]">
                    <p className="text-[11px] font-semibold text-slate-500">
                      Chờ chuyển (đủ ĐK)
                    </p>
                    <p className="mt-1 text-base font-extrabold text-[#1a2e1a]">
                      {formatVnd(waitPayoutAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FBF8F1] px-3 py-3 ring-1 ring-[#E8E2D6]">
                    <p className="text-[11px] font-semibold text-slate-500">
                      Tạm giữ / kỳ đã chốt
                    </p>
                    <p className="mt-1 text-base font-extrabold text-[#1a2e1a]">
                      {formatVnd(stats.held.amount + totalLocked)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E8E2D6]">
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-xs">
                <thead className="bg-[#FBF8F1] text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Kỳ hoa hồng</th>
                    <th className="px-4 py-3">Tháng đơn</th>
                    <th className="px-4 py-3 text-right">HH đủ ĐK (đ)</th>
                    <th className="px-4 py-3 text-right">Thực nhận (đ)</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9DD]">
                  {!filteredBills.length ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Chưa có kỳ đối soát trong khoảng đã chọn.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((b) => {
                      const pl = formatPeriodLabel(b.period);
                      const title =
                        typeof pl === "string" ? pl : pl.title;
                      const rangeText =
                        typeof pl === "string" ? "" : pl.range;
                      const status =
                        b.billStatus === "paid" || b.paidAt
                          ? "Đã thanh toán"
                          : b.billStatus === "locked"
                            ? "Đã chốt — chờ chuyển"
                            : b.billStatus;
                      return (
                        <tr key={b.period} className="hover:bg-[#FBF8F1]/60">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[#1a2e1a]">
                              {title}
                            </div>
                            {rangeText ? (
                              <div className="text-[11px] text-slate-500">
                                {rangeText}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {b.period}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#1a2e1a]">
                            {formatVnd(b.gross ?? b.net)}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-[var(--aloha-green)]">
                            {formatVnd(b.net)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {status}
                            </span>
                            <div className="mt-1 text-[10px] text-slate-500">
                              {b.orderCount} đơn
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setBillDetail(b)}
                              className="text-xs font-bold text-[var(--aloha-green)] hover:underline"
                            >
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {billDetail ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setBillDetail(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="text-sm font-extrabold text-[#1a2e1a]">
                  Chi tiết kỳ {billDetail.period}
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li className="flex justify-between">
                    <span>Số đơn</span>
                    <span className="font-bold">{billDetail.orderCount}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>HH đủ điều kiện</span>
                    <span className="font-bold">
                      {formatVnd(billDetail.gross ?? billDetail.net)}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Thực nhận</span>
                    <span className="font-extrabold text-[var(--aloha-green)]">
                      {formatVnd(billDetail.net)}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Trạng thái</span>
                    <span className="font-bold">
                      {billDetail.billStatus === "paid" || billDetail.paidAt
                        ? "Đã thanh toán"
                        : billDetail.billStatus === "locked"
                          ? "Đã chốt — chờ chuyển"
                          : billDetail.billStatus}
                    </span>
                  </li>
                  {billDetail.paidAt ? (
                    <li className="flex justify-between">
                      <span>Ngày chi</span>
                      <span className="font-bold">
                        {formatDt(billDetail.paidAt)}
                      </span>
                    </li>
                  ) : null}
                </ul>
                <button
                  type="button"
                  onClick={() => setBillDetail(null)}
                  className="mt-5 w-full rounded-lg bg-[var(--aloha-green)] py-2.5 text-sm font-bold text-white"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {err && stats ? (
        <p className="text-[11px] text-amber-700">{err}</p>
      ) : null}
    </div>
  );
}
