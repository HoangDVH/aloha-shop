"use client";

/**
 * Hub CTV — UI sát mockup sage/Antd, chỉ số liệu thật từ API.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Row,
  Segmented,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  Coins,
  ChevronRight,
  Filter,
  MousePointerClick,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "@/components/admin/toast";
import ShopCtvAffiliateAdminLegacy from "./ShopCtvAffiliateAdminLegacy";
import ShopAccountsAdmin from "./ShopAccountsAdmin";
import CtvDetailPanel from "./CtvDetailPanel";
import {
  useCtvOverview,
  useCtvCommissions,
  useCtvBills,
  useCtvFraud,
  useCtvStats,
  useCtvSettings,
  useExportBillExcel,
  useLockBill,
  useMarkBillPaid,
  useBanCtv,
  useClearCommissionFlag,
  useConfirmCommissionFraud,
  useClearSoftFraudFlags,
  useReviewFraudEvent,
  usePatchCtvSettings,
} from "./ctvQueries";
import { useCtvUiStore, type CtvAdminSub } from "./ctvUiStore";
import {
  COMMISSION_STATUS_LABEL,
  billStatusLabel,
  formatDt,
  formatFraudFlags,
  formatVnd,
  periodFromIso,
} from "./shared/format";
import { CtvPagination } from "./shared/CtvPagination";
import {
  AdminDateRangePicker,
  defaultThisMonthRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import {
  AdminKpiRowSkeleton,
  AdminRefreshingBadge,
  AdminTableSkeleton,
  CtvOverviewSkeleton,
} from "@/components/admin/ui/AdminSkeleton";

const { Text } = Typography;

const TITLE: Record<CtvAdminSub, string> = {
  overview: "Tổng quan",
  list: "Danh sách CTV",
  customers: "Quản lý khách hàng",
  commissions: "Hoa hồng",
  commissionConfig: "Cấu hình hoa hồng",
  orders: "Đơn hàng CTV",
  fraud: "Chống gian lận",
};

const SUBTITLE: Record<CtvAdminSub, string> = {
  overview: "Hiệu suất chương trình cộng tác viên theo kỳ",
  list: "Duyệt, khóa và quản lý tài khoản CTV",
  customers: "Tài khoản khách mua trên web bán",
  commissions: "Đối soát dòng hoa hồng và kỳ thanh toán",
  commissionConfig: "Đặt % hoa hồng theo SP và CTV đặc biệt",
  orders: "Đơn hàng gắn mã giới thiệu CTV",
  fraud: "Cảnh báo và xử lý hành vi bất thường",
};

function subFromPath(pathname: string): CtvAdminSub {
  if (pathname.startsWith("/admin/ctv/danh-sach")) return "list";
  if (pathname.startsWith("/admin/ctv/khach-hang")) return "customers";
  if (pathname.startsWith("/admin/ctv/cau-hinh-hoa-hong")) return "commissionConfig";
  if (pathname.startsWith("/admin/ctv/hoa-hong")) return "commissions";
  if (pathname.startsWith("/admin/ctv/don-hang")) return "orders";
  if (pathname.startsWith("/admin/ctv/chong-gian")) return "fraud";
  return "overview";
}

function detailCodeFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/admin\/ctv\/danh-sach\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]).trim().toUpperCase() || null;
  } catch {
    return m[1].trim().toUpperCase() || null;
  }
}

function changeTag(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) {
    return (
      <span className="text-[11px] font-semibold text-slate-300">—</span>
    );
  }
  const up = v >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        up ? "text-[#2D5A27]" : "text-rose-500"
      }`}
    >
      {up ? "↑" : "↓"} {Math.abs(v)}% so với tháng trước
    </span>
  );
}

/** KPI card — UI mockup: icon trái + title, số lớn, trend dưới; chiều cao đều */
function KpiCard({
  title,
  value,
  icon,
  change,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  change?: number | null;
}) {
  return (
    <div className="flex h-full min-h-[118px] flex-col rounded-xl border border-[#e8ece8] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8EFE4] text-[#2D5A27]">
          {icon}
        </div>
        <p className="m-0 min-w-0 flex-1 truncate text-[12px] font-semibold leading-snug text-slate-500">
          {title}
        </p>
      </div>
      <p className="mb-0 mt-3 truncate text-[20px] font-extrabold leading-none tracking-tight text-[#1a2e1a] tabular-nums sm:text-[22px]">
        {value}
      </p>
      <div className="mt-auto pt-2.5">{changeTag(change)}</div>
    </div>
  );
}

function shortMoney(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

function dayLabel(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso.slice(5) || iso;
  return `${m[3]}/${m[2]}`;
}

function expandDailySeries(
  range: { from: string; to: string } | string,
  data: Array<{ day: string; gmv: number; commission: number }>
) {
  const map = new Map(data.map((d) => [d.day, d]));
  const out: Array<{ day: string; gmv: number; commission: number }> = [];

  // Legacy: period YYYY-MM
  if (typeof range === "string") {
    const [y, m] = String(range || "").split("-").map(Number);
    if (!y || !m) return data;
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const day = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const hit = map.get(day);
      out.push(hit || { day, gmv: 0, commission: 0 });
    }
    return out;
  }

  const from = String(range.from || "");
  const to = String(range.to || "");
  const fm = from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = to.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fm || !tm) return data;
  let cur = new Date(Number(fm[1]), Number(fm[2]) - 1, Number(fm[3]));
  const end = new Date(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]));
  while (cur.getTime() <= end.getTime()) {
    const day = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    const hit = map.get(day);
    out.push(hit || { day, gmv: 0, commission: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function niceAxisMax(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * Combo chart kiểu sàn TMĐT: cột = doanh thu (trục trái),
 * đường = hoa hồng (trục phải) — 2 thang đo riêng để đọc được cả 2.
 */
function DailySpark({
  data,
  period,
  range,
}: {
  data: Array<{ day: string; gmv: number; commission: number }>;
  period?: string;
  range?: { from: string; to: string };
}) {
  const series = useMemo(
    () => expandDailySeries(range || period || "", data),
    [period, range, data]
  );
  const [hover, setHover] = useState<number | null>(null);

  const hasAny = series.some((d) => d.gmv > 0 || d.commission > 0);
  const totalGmv = useMemo(
    () => series.reduce((s, d) => s + (Number(d.gmv) || 0), 0),
    [series]
  );
  const totalHh = useMemo(
    () => series.reduce((s, d) => s + (Number(d.commission) || 0), 0),
    [series]
  );
  const peak = useMemo(() => {
    let best = series[0];
    for (const d of series) {
      if ((d.gmv || 0) > (best?.gmv || 0)) best = d;
    }
    return best;
  }, [series]);

  if (!hasAny) {
    return <Empty description="Chưa có doanh thu/hoa hồng theo ngày trong kỳ" />;
  }

  const W = 720;
  const H = 268;
  const pad = { top: 18, right: 48, bottom: 30, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxGmv = niceAxisMax(Math.max(...series.map((d) => d.gmv), 1));
  const maxHh = niceAxisMax(Math.max(...series.map((d) => d.commission), 1));
  const gmvTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxGmv);
  const hhTicks = [0, 0.5, 1].map((t) => t * maxHh);

  const n = series.length;
  const slot = innerW / Math.max(1, n);
  const barW = Math.max(3, Math.min(14, slot * 0.62));
  const xCenter = (i: number) => pad.left + slot * i + slot / 2;
  const yGmv = (v: number) => pad.top + innerH - (v / maxGmv) * innerH;
  const yHh = (v: number) => pad.top + innerH - (v / maxHh) * innerH;
  const baseY = pad.top + innerH;

  const hhLine = series
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yHh(d.commission)}`)
    .join(" ");

  const labelIdx = new Set<number>();
  const step = Math.max(1, Math.ceil((n - 1) / 6));
  for (let i = 0; i < n; i += step) labelIdx.add(i);
  labelIdx.add(n - 1);

  const tip = hover != null ? series[hover] : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="rounded-lg bg-[#F3F7F2] px-3 py-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Tổng DT</span>
          <span className="ml-2 text-[13px] font-extrabold text-[#2D5A27]">
            {formatVnd(totalGmv)}
          </span>
        </div>
        <div className="rounded-lg bg-[#FFF8EE] px-3 py-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Tổng HH</span>
          <span className="ml-2 text-[13px] font-extrabold text-[#c47a2c]">
            {formatVnd(totalHh)}
          </span>
        </div>
        {peak && peak.gmv > 0 ? (
          <div className="rounded-lg bg-slate-50 px-3 py-1.5">
            <span className="text-[11px] font-semibold text-slate-500">
              Ngày cao nhất
            </span>
            <span className="ml-2 text-[13px] font-extrabold text-[#1a2e1a]">
              {dayLabel(peak.day)} · {formatVnd(peak.gmv)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Doanh thu cột, hoa hồng đường theo ngày"
          onMouseLeave={() => setHover(null)}
        >
          {gmvTicks.map((t) => {
            const y = yGmv(t);
            return (
              <g key={`g-${t}`}>
                <line
                  x1={pad.left}
                  x2={W - pad.right}
                  y1={y}
                  y2={y}
                  stroke="#eef2ee"
                  strokeDasharray="3 4"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400"
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {shortMoney(t)}
                </text>
              </g>
            );
          })}
          {hhTicks.map((t) => {
            const y = yHh(t);
            return (
              <text
                key={`h-${t}`}
                x={W - pad.right + 8}
                y={y + 3}
                textAnchor="start"
                className="fill-[#c47a2c]"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {shortMoney(t)}
              </text>
            );
          })}

          {series.map((d, i) => {
            const h = Math.max(0, baseY - yGmv(d.gmv));
            const x = xCenter(i) - barW / 2;
            const active = hover === i;
            return (
              <rect
                key={`bar-${d.day}`}
                x={x}
                y={yGmv(d.gmv)}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
                fill={active ? "#1f4a1c" : "#2D5A27"}
                opacity={hover == null || active ? 1 : 0.35}
              >
                <title>
                  {dayLabel(d.day)} · DT {formatVnd(d.gmv)}
                </title>
              </rect>
            );
          })}

          <path
            d={hhLine}
            fill="none"
            stroke="#E8A017"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {series.map((d, i) =>
            d.commission > 0 || d.gmv > 0 ? (
              <circle
                key={`dot-${d.day}`}
                cx={xCenter(i)}
                cy={yHh(d.commission)}
                r={hover === i ? 4.5 : 3.2}
                fill="#fff"
                stroke="#c47a2c"
                strokeWidth={2}
              />
            ) : null
          )}

          {/* hit areas for hover */}
          {series.map((d, i) => (
            <rect
              key={`hit-${d.day}`}
              x={pad.left + slot * i}
              y={pad.top}
              width={slot}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              style={{ cursor: "crosshair" }}
            />
          ))}

          {hover != null ? (
            <line
              x1={xCenter(hover)}
              x2={xCenter(hover)}
              y1={pad.top}
              y2={baseY}
              stroke="#c5d6c3"
              strokeDasharray="3 3"
            />
          ) : null}

          {[...labelIdx].map((i) => (
            <text
              key={`x-${i}`}
              x={xCenter(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {dayLabel(series[i].day)}
            </text>
          ))}
        </svg>

        {tip && hover != null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[148px] rounded-lg border border-[#e4ebe3] bg-white px-3 py-2 shadow-lg"
            style={{
              left: `${Math.min(88, Math.max(8, (xCenter(hover) / W) * 100 - 10))}%`,
              top: 8,
            }}
          >
            <div className="text-[12px] font-bold text-[#1a2e1a]">
              {dayLabel(tip.day)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
              <span className="h-2 w-2 rounded-sm bg-[#2D5A27]" />
              DT{" "}
              <span className="font-extrabold text-[#1a2e1a]">
                {formatVnd(tip.gmv)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-[#E8A017]" />
              HH{" "}
              <span className="font-extrabold text-[#1a2e1a]">
                {formatVnd(tip.commission)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
        <span>Trục trái: Doanh thu (cột xanh)</span>
        <span className="text-[#c47a2c]">Trục phải: Hoa hồng (đường cam)</span>
      </div>
    </div>
  );
}

function ConversionCard({ clicks, orders }: { clicks: number; orders: number }) {
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


export default function CtvAdminShell() {
  const pathname = usePathname() || "/admin/ctv";
  const activeSub = subFromPath(pathname);
  const detailCode = detailCodeFromPath(pathname);
  const { periodKey, dateRange, setDateRange, setActiveSub } =
    useCtvUiStore();
  const [legacyTick, setLegacyTick] = useState(0);

  useEffect(() => {
    setActiveSub(activeSub);
  }, [activeSub, setActiveSub]);

  return (
    <div className="ctv-admin-shell flex min-h-[70vh] flex-col gap-5">
      {!detailCode ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] font-extrabold tracking-tight text-[#1a2e1a] sm:text-[24px]">
              {TITLE[activeSub]}
            </h1>
            <p className="mt-1 mb-0 text-[13px] text-slate-500">
              {SUBTITLE[activeSub]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeSub === "overview" || activeSub === "commissions" ? (
              <AdminDateRangePicker
                value={dateRange || defaultThisMonthRange()}
                onChange={(r) => {
                  if (r) setDateRange(r);
                }}
              />
            ) : null}
            {activeSub !== "list" && activeSub !== "customers" ? (
              <button
                type="button"
                onClick={() => setLegacyTick((n) => n + 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce6da] bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-[#f5f8f4]"
              >
                <RefreshCw size={14} />
                Làm mới
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {detailCode ? (
        <CtvDetailPanel
          key={`detail-${detailCode}-${legacyTick}`}
          ctvCode={detailCode}
          period={periodKey}
          dateRange={dateRange}
        />
      ) : null}
      {!detailCode && activeSub === "overview" ? (
        <OverviewPanel
          key={`ov-${dateRange?.from}-${dateRange?.to}-${legacyTick}`}
          dateRange={dateRange || defaultThisMonthRange()}
        />
      ) : null}
      {!detailCode && activeSub === "orders" ? <OrdersPanel /> : null}
      {!detailCode && activeSub === "commissions" ? (
        <CommissionsHub
          key={`hh-${periodKey}-${dateRange?.from}-${dateRange?.to}-${legacyTick}`}
          period={periodKey}
          dateRange={dateRange || defaultThisMonthRange()}
          onExported={() => setLegacyTick((n) => n + 1)}
        />
      ) : null}
      {!detailCode && activeSub === "commissionConfig" ? (
        <CommissionConfigHub key={`cfg-${legacyTick}`} />
      ) : null}
      {!detailCode && activeSub === "list" ? (
        <ShopCtvAffiliateAdminLegacy
          key={`list-${legacyTick}`}
          forcedTab="duyet-ctv"
          hideChrome
        />
      ) : null}
      {!detailCode && activeSub === "customers" ? (
        <ShopAccountsAdmin
          key={`customers-${legacyTick}`}
          embedded
          scope="customers"
          defaultTab="customer"
        />
      ) : null}
      {!detailCode && activeSub === "fraud" ? (
        <FraudPanel key={`fraud-${legacyTick}`} />
      ) : null}
    </div>
  );
}

function OverviewPanel({
  dateRange,
}: {
  dateRange: { from: string; to: string };
}) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useCtvOverview({ from: dateRange.from, to: dateRange.to });

  if (isLoading && !data) {
    return <CtvOverviewSkeleton />;
  }
  if (isError && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được tổng quan"
        description={(error as Error)?.message}
        action={
          <Button size="small" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  const d = (data || {}) as {
    ctvTotal?: number;
    ctvActive?: number;
    clicksInPeriod?: number;
    ordersInPeriod?: number;
    gmvInPeriod?: number;
    commissionInPeriod?: number;
    payableAmount?: number;
    changes?: {
      clicks?: number | null;
      orders?: number | null;
      gmv?: number | null;
      commission?: number | null;
    };
    daily?: Array<{ day: string; gmv: number; commission: number }>;
    topCtv?: Array<{
      ctvCode: string;
      fullName?: string;
      avatarUrl?: string | null;
      ctvStatus?: string | null;
      gmv: number;
      commission: number;
      orderCount: number;
    }>;
  };

  const clicks = Number(d.clicksInPeriod) || 0;
  const orders = Number(d.ordersInPeriod) || 0;
  const top = Array.isArray(d.topCtv) ? d.topCtv.slice(0, 5) : [];
  const daily = Array.isArray(d.daily) ? d.daily : [];
  const ch = d.changes || {};

  const rankBadge = [
    { bg: "#FDE8D8", color: "#C56A2D" },
    { bg: "#E8EEF2", color: "#5B6B7A" },
    { bg: "#E4F0E4", color: "#2D5A27" },
  ];

  return (
    <div className="relative space-y-4">
      <div className="absolute right-0 top-0 z-10 -translate-y-1">
        <AdminRefreshingBadge show={Boolean(isFetching && data)} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-3">
        <KpiCard
          title="Tổng số CTV"
          value={(Number(d.ctvTotal) || 0).toLocaleString("vi-VN")}
          icon={<Users size={18} strokeWidth={2} />}
        />
        <KpiCard
          title="CTV đang hoạt động"
          value={(Number(d.ctvActive) || 0).toLocaleString("vi-VN")}
          icon={<Users size={18} strokeWidth={2} />}
        />
        <KpiCard
          title="Tổng click"
          value={(Number(d.clicksInPeriod) || 0).toLocaleString("vi-VN")}
          icon={<MousePointerClick size={18} strokeWidth={2} />}
          change={ch.clicks}
        />
        <KpiCard
          title="Tổng đơn hàng"
          value={(Number(d.ordersInPeriod) || 0).toLocaleString("vi-VN")}
          icon={<ShoppingBag size={18} strokeWidth={2} />}
          change={ch.orders}
        />
        <KpiCard
          title="Doanh thu từ CTV"
          value={formatVnd(Number(d.gmvInPeriod) || 0)}
          icon={<Coins size={18} strokeWidth={2} />}
          change={ch.gmv}
        />
        <KpiCard
          title="Hoa hồng phải trả"
          value={formatVnd(Number(d.payableAmount) || 0)}
          icon={<Wallet size={18} strokeWidth={2} />}
          change={ch.commission}
        />
      </div>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={16}>
          <div className="flex flex-col gap-3.5">
            <Card
              bordered={false}
              title={
                <span className="font-bold text-[#1a2e1a]">
                  Doanh thu & Hoa hồng theo ngày
                </span>
              }
              extra={
                <div className="flex items-center gap-4 text-[12px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-3 rounded-sm bg-[#2D5A27]" />
                    Doanh thu
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E8A017]" />
                    Hoa hồng
                  </span>
                </div>
              }
              className="shadow-sm"
            >
              <DailySpark data={daily} range={dateRange} />
            </Card>

            <Card
              bordered={false}
              title={
                <span className="font-bold text-[#1a2e1a]">
                  Top CTV doanh thu cao nhất
                </span>
              }
              extra={
                <Link
                  href="/admin/ctv/danh-sach"
                  className="text-[13px] font-bold text-[#2D5A27] hover:underline"
                >
                  Xem tất cả →
                </Link>
              }
              className="shadow-sm"
              styles={{ body: { paddingTop: 4, paddingBottom: 8 } }}
            >
              {!top.length ? (
                <Empty description="Chưa có CTV trong kỳ" />
              ) : (
                <div className="divide-y divide-[#eef2ee]">
                  {top.map((t, i) => {
                    const name = String(t.fullName || t.ctvCode || "—");
                    const badge = rankBadge[i];
                    const status = String(t.ctvStatus || "");
                    const statusChip =
                      status === "active"
                        ? { label: "Hoạt động", cls: "bg-[#E8EFE4] text-[#2D5A27]" }
                        : status === "cho_duyet"
                          ? { label: "Chờ duyệt", cls: "bg-amber-50 text-amber-700" }
                          : status === "khoa"
                            ? { label: "Đã khóa", cls: "bg-rose-50 text-rose-700" }
                            : null;
                    return (
                      <Link
                        key={t.ctvCode}
                        href={`/admin/ctv/danh-sach/${encodeURIComponent(t.ctvCode)}`}
                        className="flex items-center gap-3 px-1 py-3 text-inherit no-underline transition hover:bg-[#F9FBF9]"
                      >
                        {badge ? (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[13px] font-bold text-[#1a2e1a]">
                            {i + 1}
                          </span>
                        )}
                        {t.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.avatarUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EFE4] text-[12px] font-extrabold text-[#2D5A27]">
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-[14px] font-semibold text-[#1a2e1a]">
                              {name}
                            </span>
                            {statusChip ? (
                              <span
                                className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusChip.cls}`}
                              >
                                {statusChip.label}
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {t.ctvCode}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[14px] font-extrabold tabular-nums text-[#1a2e1a]">
                            {formatVnd(t.gmv)}
                          </div>
                        </div>
                        <div className="w-[72px] shrink-0 text-right text-[12px] font-semibold text-slate-500">
                          {t.orderCount} đơn
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            bordered={false}
            title={
              <span className="font-bold text-[#1a2e1a]">Tỷ lệ chuyển đổi</span>
            }
            className="h-full shadow-sm"
          >
            <ConversionCard clicks={clicks} orders={orders} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function OrdersPanel() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCtvCommissions({
    limit: 80,
  });
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const rows = useMemo(() => {
    const list = data?.data || [];
    const map = new Map<
      string,
      {
        orderCode: string;
        ctvCode: string;
        amount: number;
        status: string;
        n: number;
        lineTotal: number;
      }
    >();
    for (const row of list) {
      const code = String(row.displayOrderCode || row.orderCode || "");
      const key = `${code}|${row.ctvCode}`;
      const cur = map.get(key) || {
        orderCode: code,
        ctvCode: String(row.ctvCode || ""),
        amount: 0,
        lineTotal: 0,
        status: String(row.status || ""),
        n: 0,
      };
      cur.amount += Number(row.amount) || 0;
      cur.lineTotal += Number(row.lineTotal) || 0;
      cur.n += 1;
      cur.status = String(row.status || cur.status);
      map.set(key, cur);
    }
    return [...map.values()];
  }, [data]);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  if (isLoading && !data) {
    return (
      <AdminTableSkeleton
        rows={8}
        cols={7}
        headers={["#", "Đơn", "CTV", "Dòng", "DT", "HH", "TT"]}
      />
    );
  }
  if (isError && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message={(error as Error)?.message || "Lỗi tải đơn CTV"}
        action={<Button onClick={() => void refetch()}>Thử lại</Button>}
      />
    );
  }

  return (
    <Card
      bordered={false}
      className="relative shadow-sm"
      title="Đơn hàng gắn cộng tác viên"
      extra={<AdminRefreshingBadge show={Boolean(isFetching && data)} />}
    >
      {!rows.length ? (
        <Empty description="Chưa có đơn hàng gắn cộng tác viên" />
      ) : (
        <>
          <Table
            size="middle"
            rowKey={(r) => `${r.orderCode}-${r.ctvCode}`}
            dataSource={pageRows}
            pagination={false}
            columns={[
              {
                title: "#",
                width: 48,
                render: (_: unknown, __: unknown, i: number) =>
                  (page - 1) * pageSize + i + 1,
              },
              {
                title: "Đơn hàng",
                dataIndex: "orderCode",
                render: (v: string) => (
                  <span className="font-bold text-[#2D5A27]">#{v}</span>
                ),
              },
              { title: "CTV", dataIndex: "ctvCode" },
              { title: "Số dòng HH", dataIndex: "n", width: 100 },
              {
                title: "Doanh thu",
                dataIndex: "lineTotal",
                render: (v: number) => formatVnd(v),
              },
              {
                title: "Hoa hồng",
                dataIndex: "amount",
                render: (v: number) => (
                  <span className="font-bold">{formatVnd(v)}</span>
                ),
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                render: (s: string) => statusTag(s),
              },
            ]}
          />
          <CtvPagination
            page={page}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            itemLabel="đơn"
          />
        </>
      )}
    </Card>
  );
}

function statusTag(s: string) {
  const map: Record<string, { color: string; label: string }> = {
    held: { color: "orange", label: COMMISSION_STATUS_LABEL.held },
    eligible: { color: "green", label: COMMISSION_STATUS_LABEL.eligible },
    billed: { color: "blue", label: COMMISSION_STATUS_LABEL.billed },
    paid_out: { color: "cyan", label: COMMISSION_STATUS_LABEL.paid_out },
    cancelled: { color: "red", label: COMMISSION_STATUS_LABEL.cancelled },
    flagged: { color: "magenta", label: COMMISSION_STATUS_LABEL.flagged },
  };
  const m = map[s] || { color: "default", label: COMMISSION_STATUS_LABEL[s] || s };
  return <Tag color={m.color}>{m.label}</Tag>;
}

function CommissionsHub({
  period,
  dateRange,
  onExported,
}: {
  period: string;
  dateRange: { from: string; to: string };
  onExported: () => void;
}) {
  const [seg, setSeg] = useState<"dong" | "ky">("dong");
  const [drillCtv, setDrillCtv] = useState<string | null>(null);
  const [listSeedCtv, setListSeedCtv] = useState<string | undefined>();
  const [listSeedPeriod, setListSeedPeriod] = useState<string | undefined>();
  const billQ = useCtvBills(period);
  const statsQ = useCtvStats();
  const lockM = useLockBill();
  const paidM = useMarkBillPaid();
  const exportM = useExportBillExcel();
  const bill = billQ.data?.bill;
  const preview = billQ.data?.preview;
  const st = (statsQ.data || {}) as Record<string, unknown>;
  const billLocked = bill?.status === "locked" || bill?.status === "paid";
  const tableLines = billLocked
    ? (Array.isArray(bill?.ctvLines) ? bill.ctvLines : [])
    : (Array.isArray(preview?.ctvLines) ? preview!.ctvLines : []);
  const tableTotals = billLocked ? bill?.totals : preview?.totals;

  const summary =
    seg === "ky"
      ? [
          {
            title: "Tổng kỳ này",
            value: formatVnd(Number(tableTotals?.commission) || 0),
            sub: `${Number(tableTotals?.ctvCount) || 0} CTV · ${Number(tableTotals?.orderCount) || 0} đơn`,
            tone: "#2D5A27",
          },
          {
            title: "Trạng thái kỳ",
            value: billStatusLabel(bill?.status),
            sub: period,
            tone: billLocked ? "#3b82f6" : "#c47a2c",
          },
          {
            title: "Đủ điều kiện (shop)",
            value: formatVnd(Number(st.eligibleAmount) || 0),
            sub: `${st.eligibleCount || 0} dòng toàn shop`,
            tone: "#2D5A27",
          },
          {
            title: "Đã vào kỳ chưa chi",
            value: formatVnd(Number(st.billedAmount) || 0),
            sub: `${st.billedCount || 0} dòng billed`,
            tone: "#7c3aed",
          },
        ]
      : [
          {
            title: "Hoa hồng đang giữ",
            value: formatVnd(Number(st.heldAmount) || 0),
            sub: `${st.heldCount || 0} dòng`,
            tone: "#c47a2c",
          },
          {
            title: "Đủ điều kiện chi",
            value: formatVnd(Number(st.eligibleAmount) || 0),
            sub: `${st.eligibleCount || 0} dòng`,
            tone: "#2D5A27",
          },
          {
            title: `Kỳ ${period}`,
            value: billStatusLabel(bill?.status),
            sub: formatVnd(
              Number(bill?.totals?.commission) ||
                Number(preview?.totals?.commission) ||
                0
            ),
            tone: "#3b82f6",
          },
          {
            title: "Sẵn sàng chi",
            value: formatVnd(Number(st.eligibleAmount) || 0),
            sub: "Chỉ dòng đủ điều kiện (không gồm đang giữ)",
            tone: "#7c3aed",
          },
        ];

  return (
    <div className="space-y-4">
      <Row gutter={[12, 12]}>
        {summary.map((s) => (
          <Col xs={24} sm={12} lg={6} key={s.title}>
            <Card
              bordered={false}
              className="shadow-sm"
              styles={{
                body: {
                  borderLeft: `3px solid ${s.tone}`,
                  padding: "14px 16px",
                },
              }}
            >
              <p className="m-0 text-[12px] font-semibold text-slate-500">
                {s.title}
              </p>
              <p className="mt-1 mb-0 text-lg font-extrabold text-[#1a2e1a]">
                {s.value}
              </p>
              <p className="mb-0 mt-1 text-[11px] text-slate-400">{s.sub}</p>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="overflow-hidden rounded-xl border border-[#e4ebe3] bg-white shadow-sm">
        <div className="border-b border-[#eef2ee] bg-[#f4f6f4] px-3 py-2.5">
          <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
            Thanh toán & đối soát
          </div>
          <Segmented
            block
            value={seg}
            onChange={(v) => setSeg(v as "dong" | "ky")}
            options={[
              { label: "Theo dòng (giao dịch)", value: "dong" },
              { label: "Theo kỳ (thanh toán)", value: "ky" },
            ]}
          />
        </div>

        <div className="p-4">
          {seg === "ky" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#d7e3d2] bg-[#f7faf6] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Tag
                        color={
                          bill?.status === "paid"
                            ? "cyan"
                            : bill?.status === "locked"
                              ? "blue"
                              : "orange"
                        }
                      >
                        {billStatusLabel(bill?.status)}
                      </Tag>
                      <span className="text-[12px] text-slate-500">
                        Statement · {period}
                        {bill?.id ? ` · ${bill.id}` : ""}
                      </span>
                    </div>
                    <h3 className="m-0 text-lg font-extrabold text-[#1a2e1a]">
                      Kỳ thanh toán {period}
                    </h3>
                    <p className="mb-0 mt-1 text-sm text-slate-600">
                      {Number(tableTotals?.ctvCount) || 0} CTV ·{" "}
                      {Number(tableTotals?.orderCount) || 0} đơn
                      {bill?.lockedBy ? ` · chốt bởi ${bill.lockedBy}` : ""}
                      {bill?.paidBy ? ` · chi bởi ${bill.paidBy}` : ""}
                    </p>
                    {!billLocked ? (
                      <p className="mb-0 mt-1 text-[12px] text-amber-700">
                        Đang xem trước dòng đủ điều kiện — bấm «Chốt kỳ» để khóa sổ như sàn.
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Tổng hoa hồng
                    </div>
                    <div className="text-2xl font-black text-[#2D5A27]">
                      {formatVnd(Number(tableTotals?.commission) || 0)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="primary"
                    loading={lockM.isPending}
                    disabled={bill?.status === "locked" || bill?.status === "paid"}
                    onClick={() => {
                      const ok = window.confirm(
                        `Chốt kỳ ${period}? Sau khi chốt, các dòng đủ điều kiện sẽ vào kỳ thanh toán.`
                      );
                      if (!ok) return;
                      lockM.mutate(period, {
                        onSuccess: () => toast.success("Đã chốt kỳ"),
                        onError: (e) => toast.error((e as Error).message),
                      });
                    }}
                  >
                    Chốt kỳ thanh toán
                  </Button>
                  <Button
                    loading={exportM.isPending}
                    disabled={bill?.status !== "locked" && bill?.status !== "paid"}
                    onClick={() => {
                      exportM.mutate(period, {
                        onSuccess: () => {
                          toast.success("Đã tải Excel");
                          onExported();
                        },
                        onError: (e) => toast.error((e as Error).message),
                      });
                    }}
                  >
                    Xuất Excel chuyển khoản
                  </Button>
                  <Button
                    loading={paidM.isPending}
                    disabled={bill?.status !== "locked"}
                    onClick={() => {
                      const ok = window.confirm(
                        `Đánh dấu đã chuyển khoản cả kỳ ${period}?`
                      );
                      if (!ok) return;
                      paidM.mutate(period, {
                        onSuccess: () =>
                          toast.success("Đã đánh dấu thanh toán xong"),
                        onError: (e) => toast.error((e as Error).message),
                      });
                    }}
                  >
                    Đã chuyển khoản xong
                  </Button>
                </div>
              </div>

              {billQ.isLoading ? (
                <Spin />
              ) : tableLines.length ? (
                <Table
                  size="middle"
                  pagination={false}
                  rowKey={(r: any) => String(r.ctvCode || "")}
                  dataSource={tableLines}
                  onRow={(r: any) => ({
                    onClick: () => {
                      const code = String(r.ctvCode || "").trim();
                      if (code) setDrillCtv(code);
                    },
                    className: "cursor-pointer hover:!bg-[#f3f7f2]",
                  })}
                  columns={[
                    {
                      title: "CTV",
                      key: "ctv",
                      render: (_: unknown, r: any) => (
                        <div>
                          <div className="font-semibold text-[#2D5A27]">{r.ctvCode}</div>
                          {r.ctvName ? (
                            <div className="text-[12px] text-slate-500">{r.ctvName}</div>
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      title: "Đơn",
                      dataIndex: "orderCount",
                      width: 72,
                      render: (n: number) => Number(n) || 0,
                    },
                    {
                      title: "Hoa hồng",
                      dataIndex: "net",
                      align: "right" as const,
                      render: (n: number) => (
                        <span className="font-bold">{formatVnd(Number(n) || 0)}</span>
                      ),
                    },
                    {
                      title: "Chi CTV",
                      key: "paid",
                      width: 140,
                      render: (_: unknown, l: any) =>
                        l.paidAt ? (
                          <Tag color="cyan">Đã chi</Tag>
                        ) : bill?.status === "locked" ? (
                          <Button
                            size="small"
                            loading={paidM.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              const ok = window.confirm(
                                `Xác nhận đã chuyển khoản cho ${l.ctvCode}?`
                              );
                              if (!ok) return;
                              paidM.mutate(
                                { period, ctvCode: String(l.ctvCode || "") },
                                {
                                  onSuccess: () =>
                                    toast.success(`Đã chi ${l.ctvCode}`),
                                  onError: (err) =>
                                    toast.error((err as Error).message),
                                }
                              );
                            }}
                          >
                            Chi CTV này
                          </Button>
                        ) : (
                          <Text type="secondary">Chưa chốt kỳ</Text>
                        ),
                    },
                    {
                      title: "",
                      key: "detail",
                      width: 128,
                      align: "right" as const,
                      render: () => (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2D5A27]">
                          Xem chi tiết
                          <ChevronRight size={16} aria-hidden />
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty description="Chưa có hoa hồng đủ điều kiện trong kỳ này" />
              )}
            </div>
          ) : null}

          <PeriodCtvLinesDrawer
            open={Boolean(drillCtv)}
            ctvCode={drillCtv || ""}
            period={period}
            billStatus={bill?.status}
            onClose={() => setDrillCtv(null)}
            onOpenFullList={(code) => {
              setListSeedCtv(code);
              setListSeedPeriod(period);
              setSeg("dong");
              setDrillCtv(null);
            }}
            onPayCtv={
              bill?.status === "locked"
                ? (code) => {
                    const ok = window.confirm(
                      `Xác nhận đã chuyển khoản cho ${code}?`
                    );
                    if (!ok) return;
                    paidM.mutate(
                      { period, ctvCode: code },
                      {
                        onSuccess: () => toast.success(`Đã chi ${code}`),
                        onError: (e) => toast.error((e as Error).message),
                      }
                    );
                  }
                : undefined
            }
            payPending={paidM.isPending}
          />

          {seg === "dong" ? (
            <CommissionLinesTable
              embedded
              initialCtv={listSeedCtv}
              initialPeriod={listSeedPeriod}
              onGoPeriod={() => setSeg("ky")}
              hubPeriod={period}
              hubRange={dateRange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommissionConfigHub() {
  const [tab, setTab] = useState<"pct" | "dacbiet">("pct");
  return (
    <div className="overflow-hidden rounded-xl border border-[#e4ebe3] bg-white shadow-sm">
      <div className="border-b border-[#eef2ee] bg-[#faf9f6] px-3 py-2.5">
        <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
          Chương trình CTV · cấu hình
        </div>
        <Segmented
          block
          value={tab}
          onChange={(v) => setTab(v as "pct" | "dacbiet")}
          options={[
            { label: "Đặt % hoa hồng", value: "pct" },
            { label: "CTV đặc biệt", value: "dacbiet" },
          ]}
        />
      </div>
      <div className="p-4">
        <p className="mb-3 mt-0 text-[13px] text-slate-500">
          Cấu hình rate tách khỏi trang thanh toán — giống Affiliate settings trên sàn
          (Shopee / TikTok). Đối soát tiền xem tại{" "}
          <Link href="/admin/ctv/hoa-hong" className="font-semibold text-[#2D5A27] hover:underline">
            Hoa hồng
          </Link>
          .
        </p>
        <ShopCtvAffiliateAdminLegacy
          forcedTab={tab === "pct" ? "dat-phan-tram" : "ctv-dac-biet"}
          hideChrome
        />
      </div>
    </div>
  );
}

function PeriodCtvLinesDrawer({
  open,
  ctvCode,
  period,
  billStatus,
  onClose,
  onOpenFullList,
  onPayCtv,
  payPending,
}: {
  open: boolean;
  ctvCode: string;
  period: string;
  billStatus?: string;
  onClose: () => void;
  onOpenFullList: (ctvCode: string) => void;
  onPayCtv?: (ctvCode: string) => void;
  payPending?: boolean;
}) {
  const isLocked = billStatus === "locked" || billStatus === "paid";
  const [activeTab, setActiveTab] = useState<string>(isLocked ? "billed" : "all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (open) {
      setPage(1);
      setActiveTab(isLocked ? "billed" : "all");
    }
  }, [open, ctvCode, period, isLocked]);

  const queryParams = useMemo(() => {
    if (!open || !ctvCode) return { enabled: false };
    if (activeTab === "billed") {
      return {
        ctvCode,
        period,
        status: "billed,paid_out",
        inBill: true,
        page,
        limit: pageSize,
        enabled: true,
      };
    }
    if (activeTab === "eligible") {
      return {
        ctvCode,
        period,
        status: "eligible",
        page,
        limit: pageSize,
        enabled: true,
      };
    }
    return {
      ctvCode,
      period,
      page,
      limit: pageSize,
      enabled: true,
    };
  }, [open, ctvCode, period, activeTab, page, pageSize]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useCtvCommissions(queryParams);
  const rows = open && ctvCode ? data?.data || [] : [];
  const total = Number(data?.total) || rows.length;
  const totalHh = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const ctvName = String(rows[0]?.ctvName || "").trim();
  const periodCounts = data?.periodCounts;

  const tabItems = useMemo(() => {
    if (isLocked) {
      return [
        {
          key: "billed",
          label: (
            <span className="flex items-center gap-1.5">
              <span>Đã vào kỳ thanh toán</span>
              {periodCounts?.inBill != null ? (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[11px] font-semibold text-blue-700">
                  {periodCounts.inBill}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: "eligible",
          label: (
            <span className="flex items-center gap-1.5">
              <span>Đơn đủ điều kiện chờ kỳ tới</span>
              {periodCounts?.eligible != null ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-700">
                  {periodCounts.eligible}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: "all",
          label: (
            <span className="flex items-center gap-1.5">
              <span>Tất cả đơn phát sinh trong tháng</span>
              {periodCounts?.all != null ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-700">
                  {periodCounts.all}
                </span>
              ) : null}
            </span>
          ),
        },
      ];
    }
    return [
      {
        key: "eligible",
        label: (
          <span className="flex items-center gap-1.5">
            <span>Đủ điều kiện chi (dự kiến chốt)</span>
            {periodCounts?.eligible != null ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-700">
                {periodCounts.eligible}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "all",
        label: (
          <span className="flex items-center gap-1.5">
            <span>Tất cả đơn trong tháng</span>
            {periodCounts?.all != null ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[11px] font-semibold text-slate-700">
                {periodCounts.all}
              </span>
            ) : null}
          </span>
        ),
      },
    ];
  }, [isLocked, periodCounts]);

  return (
    <Drawer
      title={
        <div>
          <div className="text-[15px] font-bold text-[#1a2e1a]">
            Chi tiết hoa hồng ·{" "}
            <Link
              href={`/admin/ctv/danh-sach/${encodeURIComponent(ctvCode)}`}
              className="text-[#2D5A27] hover:underline"
            >
              {ctvCode || "—"}
            </Link>
          </div>
          <div className="text-[12px] font-normal text-slate-500">
            {ctvName ? `${ctvName} · ` : ""}
            Kỳ {period} · {total} dòng
            {rows.length ? ` · trang này ${formatVnd(totalHh)}` : ""}
            {billStatus ? ` · ${billStatusLabel(billStatus)}` : ""}
          </div>
        </div>
      }
      open={open}
      onClose={onClose}
      width={Math.min(960, typeof window !== "undefined" ? window.innerWidth - 24 : 960)}
      destroyOnClose
      extra={
        <Space wrap>
          {onPayCtv ? (
            <Button
              type="primary"
              size="small"
              loading={payPending}
              onClick={() => onPayCtv(ctvCode)}
            >
              Chi CTV này
            </Button>
          ) : null}
          <Button
            size="small"
            onClick={() => {
              if (ctvCode) onOpenFullList(ctvCode);
            }}
          >
            Mở tab Theo dòng
          </Button>
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Làm mới
          </Button>
        </Space>
      }
    >
      <div className="mb-3">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k);
            setPage(1);
          }}
          items={tabItems}
          className="!mb-2"
        />
        {activeTab === "billed" && isLocked ? (
          <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-[12.5px] text-blue-900 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-blue-800">Đơn trong kỳ thanh toán đã chốt:</span> Chỉ hiển thị các đơn được khóa sổ trong kỳ {period} (khớp với số tiền chốt ngoài bảng đối soát).
            </div>
            {periodCounts?.inBillSum != null ? (
              <span className="font-bold text-blue-800">
                {periodCounts.inBill} đơn · {formatVnd(periodCounts.inBillSum)}
              </span>
            ) : null}
          </div>
        ) : null}
        {activeTab === "eligible" ? (
          <div className="mb-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-900 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-emerald-800">Đơn đủ điều kiện chờ kỳ tới:</span> Đã hết hạn đổi/trả nhưng chưa nằm trong đợt chốt kỳ này. Sẽ được đưa vào đợt thanh toán kế tiếp.
            </div>
            {periodCounts?.eligibleSum != null ? (
              <span className="font-bold text-emerald-800">
                {periodCounts.eligible} đơn · {formatVnd(periodCounts.eligibleSum)}
              </span>
            ) : null}
          </div>
        ) : null}
        {activeTab === "all" ? (
          <div className="mb-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12.5px] text-slate-700 flex flex-wrap items-center justify-between gap-1">
            <div>
              <span className="font-semibold text-slate-800">Tất cả đơn phát sinh:</span> Toàn bộ các dòng hoa hồng của CTV trong kỳ (đang giữ đổi trả, cảnh báo gian lận, đủ điều kiện và đã chốt).
            </div>
            {periodCounts?.allSum != null ? (
              <span className="font-bold text-slate-800">
                {periodCounts.all} đơn · {formatVnd(periodCounts.allSum)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading && !data ? <Spin /> : null}
      {isError ? (
        <Alert
          type="error"
          message={(error as Error).message}
          action={<Button onClick={() => void refetch()}>Thử lại</Button>}
        />
      ) : null}
      {!isLoading && !rows.length ? (
        <Empty
          description={
            activeTab === "billed"
              ? "Không có đơn nào trong kỳ thanh toán này"
              : activeTab === "eligible"
              ? "Không có đơn nào đang chờ kỳ tới"
              : "Không có dòng hoa hồng trong kỳ này"
          }
        />
      ) : null}
      {rows.length ? (
        <>
          <Table
            size="small"
            rowKey={(r) => String(r.id)}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 900 }}
            columns={[
              {
                title: "Click",
                dataIndex: "clickAt",
                width: 132,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600">{formatDt(v)}</span>
                ),
              },
              {
                title: "Mua",
                dataIndex: "purchasedAt",
                width: 132,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600">{formatDt(v)}</span>
                ),
              },
              {
                title: "Đơn",
                dataIndex: "displayOrderCode",
                render: (v: string, r: any) => {
                  const code = String(v || r.orderCode || "").trim();
                  if (!code) return "—";
                  return (
                    <Link
                      href={`/don-hang/${encodeURIComponent(r.orderCode || code)}`}
                      className="font-bold text-[#2D5A27] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{code}
                    </Link>
                  );
                },
              },
              { title: "SP", dataIndex: "ma", width: 88 },
              {
                title: "DT",
                dataIndex: "lineTotal",
                width: 100,
                render: (v: number) => formatVnd(Number(v) || 0),
              },
              {
                title: "%",
                width: 56,
                render: (_: unknown, r: any) => `${r.rate ?? "—"}%`,
              },
              {
                title: "HH",
                dataIndex: "amount",
                width: 100,
                render: (v: number) => (
                  <span className="font-extrabold">{formatVnd(Number(v) || 0)}</span>
                ),
              },
              {
                title: "TT",
                dataIndex: "status",
                width: 120,
                render: (s: string, r: any) => (
                  <div>
                    {statusTag(s)}
                    {Array.isArray(r.fraudFlags) && r.fraudFlags.length ? (
                      <div className="mt-1 text-[11px] text-rose-600">
                        {formatFraudFlags(r.fraudFlags)}
                      </div>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <div className="mt-3">
            <CtvPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              itemLabel="dòng"
            />
          </div>
        </>
      ) : null}
    </Drawer>
  );
}

function CommissionLinesTable({
  embedded = false,
  initialCtv,
  initialPeriod,
  onGoPeriod,
  hubPeriod,
  hubRange,
}: {
  embedded?: boolean;
  initialCtv?: string;
  initialPeriod?: string;
  onGoPeriod?: () => void;
  hubPeriod?: string;
  hubRange?: { from: string; to: string };
}) {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filterCtv, setFilterCtv] = useState("");
  const [appliedCtv, setAppliedCtv] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  useEffect(() => {
    if (!initialCtv) return;
    const code = String(initialCtv).trim().toUpperCase();
    if (!code) return;
    setFilterCtv(code);
    setAppliedCtv(code);
    setPage(1);
  }, [initialCtv]);

  useEffect(() => {
    if (!initialPeriod) return;
    const p = String(initialPeriod).trim();
    if (!/^\d{4}-\d{2}$/.test(p)) return;
    setFilterPeriod(p);
    setAppliedPeriod(p);
    setPage(1);
  }, [initialPeriod]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [status, qDebounced, appliedCtv, appliedPeriod, hubRange?.from, hubRange?.to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useCtvCommissions({
    status,
    q: qDebounced || undefined,
    ctvCode: appliedCtv || undefined,
    period: appliedPeriod || undefined,
    from: !appliedPeriod && hubRange?.from ? hubRange.from : undefined,
    to: !appliedPeriod && hubRange?.to ? hubRange.to : undefined,
    page,
    limit: pageSize,
  });
  const clearFlag = useClearCommissionFlag();
  const confirmFraud = useConfirmCommissionFraud();
  const clearSoft = useClearSoftFraudFlags();
  const rows = data?.data || [];
  const total = Number(data?.total) || rows.length;
  const filterActive = Boolean(appliedCtv || appliedPeriod);

  const headerExtra = (
    <Button
      size="small"
      loading={clearSoft.isPending}
      onClick={() => {
        const ok = window.confirm(
          "Gỡ tất cả cờ chỉ do trùng SĐT (không phải tự mua)? Các dòng self-buy sẽ giữ nguyên."
        );
        if (!ok) return;
        clearSoft.mutate(undefined, {
          onSuccess: (r) =>
            toast.success(`Đã gỡ ${r.modified || 0} dòng cờ mềm`),
          onError: (e) => toast.error((e as Error).message),
        });
      }}
    >
      Gỡ cờ trùng SĐT (hàng loạt)
    </Button>
  );

  const wrap = (children: React.ReactNode) =>
    embedded ? (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-[15px] font-bold text-[#1a2e1a]">
            Theo dòng · giao dịch hoa hồng
          </h3>
          {headerExtra}
        </div>
        {children}
      </div>
    ) : (
      <Card
        bordered={false}
        className="shadow-sm"
        title="Danh sách dòng hoa hồng"
        extra={headerExtra}
      >
        {children}
      </Card>
    );

  return wrap(
    <>
      <Tabs
        activeKey={status || "all"}
        onChange={(k) => setStatus(k === "all" ? undefined : k)}
        items={[
          { key: "all", label: "Tất cả" },
          { key: "held", label: "Đang giữ" },
          { key: "eligible", label: "Đủ điều kiện" },
          { key: "billed", label: "Đã vào kỳ" },
          { key: "paid_out", label: "Đã thanh toán" },
          { key: "cancelled", label: "Đã hủy" },
          { key: "flagged", label: "Nghi gian lận" },
        ]}
        className="!mb-3"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          allowClear
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên CTV, mã đơn…"
          prefix={<Search size={15} className="text-slate-400" />}
          className="min-w-[220px] flex-1 sm:max-w-md"
        />
        <Dropdown
          open={filterOpen}
          onOpenChange={setFilterOpen}
          trigger={["click"]}
          dropdownRender={() => (
            <div className="w-[280px] rounded-xl border border-[#e4ebe3] bg-white p-3 shadow-lg">
              <p className="mb-2 mt-0 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                Bộ lọc
              </p>
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                Mã CTV
              </label>
              <Input
                allowClear
                value={filterCtv}
                onChange={(e) => setFilterCtv(e.target.value.toUpperCase())}
                placeholder="VD: NGUYENVANC"
                className="mb-3"
              />
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                Kỳ thanh toán
              </label>
              <input
                type="month"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
              />
              <label className="mb-1 block text-[12px] font-semibold text-slate-600">
                Trạng thái
              </label>
              <select
                value={status || "all"}
                onChange={(e) =>
                  setStatus(e.target.value === "all" ? undefined : e.target.value)
                }
                className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="held">Đang giữ</option>
                <option value="eligible">Đủ điều kiện</option>
                <option value="billed">Đã vào kỳ</option>
                <option value="paid_out">Đã thanh toán</option>
                <option value="cancelled">Đã hủy</option>
                <option value="flagged">Nghi gian lận</option>
              </select>
              <div className="flex justify-end gap-2">
                <Button
                  size="small"
                  onClick={() => {
                    setFilterCtv("");
                    setAppliedCtv("");
                    setFilterPeriod("");
                    setAppliedPeriod("");
                    setStatus(undefined);
                    setFilterOpen(false);
                  }}
                >
                  Xóa lọc
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setAppliedCtv(filterCtv.trim());
                    setAppliedPeriod(filterPeriod.trim());
                    setFilterOpen(false);
                  }}
                >
                  Áp dụng
                </Button>
              </div>
            </div>
          )}
        >
          <Button
            icon={<Filter size={14} />}
            className={filterActive ? "!border-[#2D5A27] !text-[#2D5A27]" : undefined}
          >
            Lọc{filterActive ? ` · ${[appliedCtv && "CTV", appliedPeriod && "Kỳ"].filter(Boolean).length}` : ""}
          </Button>
        </Dropdown>
      </div>

      {isLoading && !data ? (
        <AdminTableSkeleton
          rows={8}
          cols={9}
          headers={[
            "Click",
            "Mua",
            "CTV",
            "Đơn",
            "SP",
            "DT",
            "%",
            "HH",
            "TT",
          ]}
        />
      ) : null}
      {isError && !data ? (
        <Alert
          type="error"
          message={(error as Error).message}
          action={<Button onClick={() => void refetch()}>Thử lại</Button>}
        />
      ) : null}
      {!isLoading && !rows.length ? (
        <Empty
          description={
            <div className="space-y-2">
              <p className="m-0">Chưa có dòng hoa hồng theo bộ lọc hiện tại.</p>
              <p className="m-0 text-[12px] text-slate-500">
                Đang giữ / chưa đủ điều kiện sẽ không nằm trong kỳ thanh toán. Xem kỳ{" "}
                <b>{hubPeriod || appliedPeriod || "hiện tại"}</b> để chốt chi.
              </p>
              {onGoPeriod ? (
                <Button type="link" onClick={onGoPeriod}>
                  Sang tab Theo kỳ (thanh toán)
                </Button>
              ) : null}
            </div>
          }
        />
      ) : null}
      {rows.length ? (
        <>
          <div className="mb-1 flex justify-end">
            <AdminRefreshingBadge show={Boolean(isFetching && data)} />
          </div>
          <Table
            size="middle"
            rowKey={(r) => String(r.id)}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 1480 }}
            columns={[
              {
                title: "Thời gian click",
                dataIndex: "clickAt",
                width: 148,
                ellipsis: false,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600">
                    {formatDt(v)}
                  </span>
                ),
              },
              {
                title: "Thời gian mua",
                dataIndex: "purchasedAt",
                width: 148,
                render: (v: string | null) => (
                  <span className="whitespace-nowrap text-slate-600">
                    {formatDt(v)}
                  </span>
                ),
              },
              {
                title: "CTV",
                dataIndex: "ctvCode",
                width: 140,
                render: (v: string, r: any) => (
                  <div>
                    <span className="font-semibold">{v}</span>
                    {r.ctvName ? (
                      <div className="text-[11px] text-slate-500">{r.ctvName}</div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: "Đơn hàng",
                dataIndex: "displayOrderCode",
                width: 120,
                render: (v: string, r: any) => {
                  const code = String(v || r.orderCode || "").trim();
                  if (!code) return "—";
                  return (
                    <Link
                      href={`/don-hang/${encodeURIComponent(r.orderCode || code)}`}
                      className="font-bold whitespace-nowrap text-[#2D5A27] hover:underline"
                    >
                      #{code}
                    </Link>
                  );
                },
              },
              {
                title: "Sản phẩm",
                dataIndex: "ma",
                width: 100,
                render: (v: string) => (
                  <span className="whitespace-nowrap font-mono text-[12px]">{v || "—"}</span>
                ),
              },
              {
                title: "Kỳ",
                key: "period",
                width: 96,
                render: (_: unknown, r: any) => {
                  const p =
                    String(r.billingPeriod || "").trim() ||
                    periodFromIso(r.eligibleAt) ||
                    "—";
                  return <span className="font-mono text-[12px] text-slate-600">{p}</span>;
                },
              },
              {
                title: "Doanh thu",
                dataIndex: "lineTotal",
                width: 112,
                align: "right" as const,
                onHeaderCell: () => ({ className: "whitespace-nowrap" }),
                render: (v: number) => (
                  <span className="whitespace-nowrap">{formatVnd(Number(v) || 0)}</span>
                ),
              },
              {
                title: "% HH",
                width: 72,
                align: "right" as const,
                onHeaderCell: () => ({ className: "whitespace-nowrap" }),
                render: (_: unknown, r: any) => (
                  <span className="whitespace-nowrap">{`${r.rate ?? "—"}%`}</span>
                ),
              },
              {
                title: "Hoa hồng",
                dataIndex: "amount",
                width: 112,
                align: "right" as const,
                onHeaderCell: () => ({ className: "whitespace-nowrap" }),
                render: (v: number) => (
                  <span className="whitespace-nowrap font-extrabold">
                    {formatVnd(Number(v) || 0)}
                  </span>
                ),
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                width: 160,
                onHeaderCell: () => ({ className: "whitespace-nowrap" }),
                render: (s: string, r: any) => (
                  <div>
                    {statusTag(s)}
                    {Array.isArray(r.fraudFlags) && r.fraudFlags.length ? (
                      <div className="mt-1 text-[11px] text-rose-600">
                        {formatFraudFlags(r.fraudFlags)}
                      </div>
                    ) : null}
                    {Array.isArray(r.fraudDetails) && r.fraudDetails.length ? (
                      <div className="mt-0.5 max-w-[220px] text-[11px] text-slate-500">
                        {r.fraudDetails.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: "Duyệt",
                width: 200,
                onHeaderCell: () => ({ className: "whitespace-nowrap" }),
                render: (_: unknown, r: any) =>
                  r.status === "flagged" ? (
                    <Space size={4} wrap>
                      <Button
                        size="small"
                        type="primary"
                        loading={clearFlag.isPending}
                        onClick={() => {
                          clearFlag.mutate(
                            { id: String(r.id) },
                            {
                              onSuccess: () => toast.success("Đã bỏ cờ — HH tiếp tục"),
                              onError: (e) => toast.error((e as Error).message),
                            }
                          );
                        }}
                      >
                        Bỏ cờ
                      </Button>
                      <Button
                        size="small"
                        danger
                        loading={confirmFraud.isPending}
                        onClick={() => {
                          const ok = window.confirm(
                            "Xác nhận gian lận và hủy hoa hồng dòng này?"
                          );
                          if (!ok) return;
                          confirmFraud.mutate(
                            {
                              id: String(r.id),
                              reason: "admin_confirm_fraud",
                            },
                            {
                              onSuccess: () => toast.success("Đã hủy HH (gian lận)"),
                              onError: (e) => toast.error((e as Error).message),
                            }
                          );
                        }}
                      >
                        Xác nhận gian
                      </Button>
                    </Space>
                  ) : (
                    <span className="text-slate-300">—</span>
                  ),
              },
            ]}
          />
          <CtvPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            itemLabel="dòng HH"
          />
        </>
      ) : null}
    </>
  );
}

function FraudSettingsCard() {
  const { data, isLoading } = useCtvSettings();
  const patchM = usePatchCtvSettings();
  const settings = data?.settings;
  const [threshold, setThreshold] = useState(10);
  const [whitelist, setWhitelist] = useState("123456789, 0123456789");
  const [softWarn, setSoftWarn] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setThreshold(Number(settings.addressMatchMaxHits) || 10);
    setWhitelist(
      Array.isArray(settings.phoneWhitelist)
        ? settings.phoneWhitelist.join(", ")
        : "123456789, 0123456789"
    );
    setSoftWarn(settings.phoneRepeatSoftWarn !== false);
  }, [settings]);

  if (isLoading) return <Spin />;
  return (
    <Card
      bordered={false}
      className="shadow-sm"
      title="Cấu hình chống gian"
      extra={
        <Button
          type="primary"
          loading={patchM.isPending}
          onClick={() => {
            patchM.mutate(
              {
                addressMatchMaxHits: threshold,
                phoneWhitelistText: whitelist,
                phoneRepeatSoftWarn: softWarn,
              },
              {
                onSuccess: () => toast.success("Đã lưu cấu hình chống gian"),
                onError: (e) => toast.error((e as Error).message),
              }
            );
          }}
        >
          Lưu
        </Button>
      }
    >
      <Row gutter={[16, 12]}>
        <Col xs={24} md={8}>
          <label className="block text-[12px] font-semibold text-slate-600">
            Ngưỡng cảnh báo trùng SĐT / 90 ngày
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 10)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-400">
            Chỉ cảnh báo mềm — không tự khóa hoa hồng (trừ khi tự mua).
          </p>
        </Col>
        <Col xs={24} md={10}>
          <label className="block text-[12px] font-semibold text-slate-600">
            Whitelist SĐT test / nội bộ (cách nhau dấu phẩy)
            <textarea
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </Col>
        <Col xs={24} md={6}>
          <label className="mt-6 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={softWarn}
              onChange={(e) => setSoftWarn(e.target.checked)}
            />
            Bật cảnh báo mềm trùng SĐT
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            <b>Hard:</b> tự mua (SĐT/địa chỉ/TK trùng CTV) → khóa HH.
            <br />
            <b>Soft:</b> trùng SĐT nhiều → chỉ cảnh báo.
          </p>
        </Col>
      </Row>
    </Card>
  );
}

function FraudPanel() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCtvFraud({
    limit: 200,
  });
  const banM = useBanCtv();
  const reviewM = useReviewFraudEvent();
  const clearFlag = useClearCommissionFlag();
  const confirmFraud = useConfirmCommissionFraud();
  const clearSoft = useClearSoftFraudFlags();
  const rows = data?.data || [];
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "open") {
      return rows.filter((r) => !r.reviewStatus || r.reviewStatus === "open");
    }
    // Gộp rule mới (phone_repeat) + sự kiện cũ (address_match)
    if (filter === "phone_dup") {
      return rows.filter((r) => {
        const t = String(r.type || "");
        return t === "phone_repeat" || t === "address_match";
      });
    }
    return rows.filter((r) => String(r.type || "") === filter);
  }, [rows, filter]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <AdminKpiRowSkeleton count={3} />
        <AdminTableSkeleton rows={8} cols={6} />
      </div>
    );
  }
  if (isError && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message={(error as Error)?.message}
        action={<Button onClick={() => void refetch()}>Thử lại</Button>}
      />
    );
  }

  return (
    <div className="relative space-y-4">
      <div className="absolute right-0 top-0 z-10">
        <AdminRefreshingBadge show={Boolean(isFetching && data)} />
      </div>
      <FraudSettingsCard />

      <Card
        bordered={false}
        className="shadow-sm"
        title="Cảnh báo gian lận"
        extra={
          <Button
            size="small"
            loading={clearSoft.isPending}
            onClick={() => {
              const ok = window.confirm(
                "Gỡ hàng loạt cờ hoa hồng chỉ do trùng SĐT (không self-buy)?"
              );
              if (!ok) return;
              clearSoft.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success(`Đã gỡ ${r.modified || 0} dòng`),
                onError: (e) => toast.error((e as Error).message),
              });
            }}
          >
            Gỡ cờ trùng SĐT
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          className="!mb-3"
          message="Phân loại"
          description="Tự mua (high) → khóa hoa hồng. Trùng SĐT (warn) → chỉ cảnh báo để admin xem. Dùng Bỏ cờ / Xác nhận gian / Bỏ qua trên từng dòng."
        />
        <Tabs
          activeKey={filter}
          onChange={setFilter}
          className="!mb-3"
          items={[
            { key: "all", label: "Tất cả" },
            { key: "open", label: "Chưa xử lý" },
            { key: "self_buy", label: "Tự mua hàng" },
            { key: "phone_dup", label: "Trùng SĐT" },
          ]}
        />
        {!filtered.length ? (
          <Empty description="Chưa có cảnh báo gian lận" />
        ) : (
          <>
          <Table
            size="middle"
            rowKey={(r) => String(r.id)}
            dataSource={paged}
            pagination={false}
            columns={[
              {
                title: "#",
                width: 48,
                render: (_: unknown, __: unknown, i: number) =>
                  (page - 1) * pageSize + i + 1,
              },
              {
                title: "Mức",
                width: 90,
                render: (_: unknown, r: any) => {
                  const sev =
                    r.severity ||
                    (String(r.type || "").includes("self") ? "high" : "warn");
                  return sev === "high" ? (
                    <Tag color="red">Cao</Tag>
                  ) : (
                    <Tag color="orange">Cảnh báo</Tag>
                  );
                },
              },
              {
                title: "Loại",
                dataIndex: "type",
                render: (v: string) => (
                  <Tag color={String(v).includes("self") ? "red" : "gold"}>
                    {v === "self_buy"
                      ? "Tự mua hàng"
                      : v === "phone_repeat" || v === "address_match"
                        ? "Trùng SĐT"
                        : v || "—"}
                  </Tag>
                ),
              },
              {
                title: "CTV",
                dataIndex: "ctvCode",
                render: (v: string) => <span className="font-bold">{v}</span>,
              },
              {
                title: "Đơn",
                render: (_: unknown, r: any) =>
                  r.displayOrderCode || r.orderCode || "—",
              },
              {
                title: "Chi tiết",
                render: (_: unknown, r: any) =>
                  Array.isArray(r.details)
                    ? r.details.join(" · ")
                    : r.details || "—",
              },
              {
                title: "Xử lý",
                dataIndex: "reviewStatus",
                width: 100,
                render: (v: string) =>
                  !v || v === "open" ? (
                    <Tag>Chưa xử lý</Tag>
                  ) : v === "confirmed" ? (
                    <Tag color="red">Đã xác nhận</Tag>
                  ) : (
                    <Tag color="green">Đã bỏ qua</Tag>
                  ),
              },
              {
                title: "Thời gian",
                dataIndex: "createdAt",
                render: (v: string) =>
                  v ? String(v).slice(0, 16).replace("T", " ") : "—",
              },
              {
                title: "Thao tác",
                width: 280,
                render: (_: unknown, r: any) => (
                  <Space size={4} wrap>
                    {r.orderCode ? (
                      <Button
                        size="small"
                        type="primary"
                        loading={clearFlag.isPending}
                        onClick={() => {
                          clearFlag.mutate(
                            {
                              orderCode: r.orderCode,
                              ctvCode: r.ctvCode,
                            },
                            {
                              onSuccess: () => {
                                toast.success("Đã bỏ cờ HH");
                                reviewM.mutate({
                                  id: String(r.id),
                                  reviewStatus: "dismissed",
                                });
                              },
                              onError: (e) =>
                                toast.error((e as Error).message),
                            }
                          );
                        }}
                      >
                        Bỏ cờ HH
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      onClick={() => {
                        reviewM.mutate(
                          { id: String(r.id), reviewStatus: "dismissed" },
                          {
                            onSuccess: () => toast.success("Đã bỏ qua cảnh báo"),
                            onError: (e) => toast.error((e as Error).message),
                          }
                        );
                      }}
                    >
                      Bỏ qua
                    </Button>
                    {r.orderCode ? (
                      <Button
                        size="small"
                        danger
                        loading={confirmFraud.isPending}
                        onClick={() => {
                          const ok = window.confirm(
                            `Xác nhận gian và hủy HH đơn ${r.displayOrderCode || r.orderCode}?`
                          );
                          if (!ok) return;
                          confirmFraud.mutate(
                            {
                              orderCode: r.orderCode,
                              ctvCode: r.ctvCode,
                              reason: r.type || "fraud",
                            },
                            {
                              onSuccess: () => {
                                toast.success("Đã xác nhận gian");
                                reviewM.mutate({
                                  id: String(r.id),
                                  reviewStatus: "confirmed",
                                });
                              },
                              onError: (e) =>
                                toast.error((e as Error).message),
                            }
                          );
                        }}
                      >
                        Xác nhận gian
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      danger
                      ghost
                      loading={banM.isPending}
                      onClick={() => {
                        const ok = window.confirm(
                          `Khóa CTV ${r.ctvCode} và hủy mọi HH chưa chi?`
                        );
                        if (!ok) return;
                        banM.mutate(
                          { ctvCode: r.ctvCode, reason: r.type || "fraud" },
                          {
                            onSuccess: () => {
                              toast.success("Đã khóa CTV");
                              void refetch();
                            },
                            onError: (e) => toast.error((e as Error).message),
                          }
                        );
                      }}
                    >
                      Khóa CTV
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
          <CtvPagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            itemLabel="cảnh báo"
          />
          </>
        )}
      </Card>
    </div>
  );
}
