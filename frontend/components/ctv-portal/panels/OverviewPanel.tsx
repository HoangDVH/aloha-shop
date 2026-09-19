"use client";

import { useMemo } from "react";
import { Alert, Card, Col, Empty, Row, Select, Spin, Statistic } from "antd";
import { DailySpark } from "../charts/DailySpark";
import { ConversionCard } from "../charts/ConversionCard";
import { useCtvMeOverview, useCtvMeStats } from "../ctvPortalQueries";
import { useCtvPortalUiStore } from "../ctvPortalUiStore";
import {
  CTV_COMMISSION_UX,
  dayKeyFromIso,
  formatCompact,
  formatMoneyCompact,
  formatVnd,
  monthRange,
} from "../shared/format";
import { visibleRefetchInterval } from "@/lib/visibleRefetchInterval";
import type { CtvOverview } from "../types";

function deriveDaily(overview: CtvOverview | undefined) {
  const map = new Map<string, { day: string; gmv: number; commission: number }>();
  const orders = overview?.lists?.orders || [];
  const commissions = overview?.lists?.commissions || [];
  const orderDay = new Map<string, string>();

  for (const o of orders) {
    const day = dayKeyFromIso(o.createdAt);
    if (!day) continue;
    orderDay.set(o.code, day);
    const cur = map.get(day) || { day, gmv: 0, commission: 0 };
    cur.gmv += Number(o.total) || 0;
    map.set(day, cur);
  }
  for (const c of commissions) {
    const day = orderDay.get(c.orderCode) || null;
    if (!day) continue;
    const cur = map.get(day) || { day, gmv: 0, commission: 0 };
    cur.commission += Number(c.amount) || 0;
    map.set(day, cur);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function OverviewPanel() {
  const { dateRange, setDateRange } = useCtvPortalUiStore();
  const statsQ = useCtvMeStats({ refetchInterval: visibleRefetchInterval(30_000) });
  const overviewQ = useCtvMeOverview(dateRange.from, dateRange.to, {
    refetchInterval: visibleRefetchInterval(30_000),
  });

  const stats = statsQ.data;
  const overview = overviewQ.data;
  const daily = useMemo(() => deriveDaily(overview), [overview]);

  const holdDays = stats?.returnHoldDays ?? 7;

  const statusCards = useMemo(() => {
    if (!stats) return [];
    const core = [
      {
        key: "held",
        label: CTV_COMMISSION_UX.held.label,
        value: formatVnd(stats.held.amount),
        explain: CTV_COMMISSION_UX.held.explain,
        hint: `${stats.held.count} dòng · chờ hết ${holdDays} ngày đổi/trả`,
        always: true,
      },
      {
        key: "eligible",
        label: CTV_COMMISSION_UX.eligible.label,
        value: formatVnd(stats.eligible.amount),
        explain: CTV_COMMISSION_UX.eligible.explain,
        hint: `${stats.eligible.count} dòng · chờ shop chi`,
        always: true,
      },
      {
        key: "billed",
        label: CTV_COMMISSION_UX.billed.label,
        value: formatVnd(stats.billed.amount),
        explain: CTV_COMMISSION_UX.billed.explain,
        hint: `${stats.billed.count} dòng · thuộc đợt thanh toán`,
        always: true,
      },
      {
        key: "paid",
        label: CTV_COMMISSION_UX.paid_out.label,
        value: formatVnd(stats.paidOut.amount),
        explain: CTV_COMMISSION_UX.paid_out.explain,
        hint: `${stats.paidOut.count} dòng · shop đã chuyển`,
        always: true,
      },
    ];
    const extras = [
      {
        key: "pending",
        label: "Chờ hoàn tất đơn",
        value: formatVnd(stats.pendingOrders?.amount || 0),
        explain: "Chưa phát sinh hoa hồng",
        hint: `${stats.pendingOrders?.count || 0} đơn · chưa giao / chưa thanh toán xong`,
        count: stats.pendingOrders?.count || 0,
        always: false,
      },
      {
        key: "flagged",
        label: CTV_COMMISSION_UX.flagged.label,
        value: formatVnd(stats.flagged?.amount || 0),
        explain: CTV_COMMISSION_UX.flagged.explain,
        hint: `${stats.flagged?.count || 0} dòng · tạm chưa chi`,
        count: stats.flagged?.count || 0,
        always: false,
      },
      {
        key: "cancelled",
        label: CTV_COMMISSION_UX.cancelled.label,
        value: formatVnd(stats.cancelled?.amount || 0),
        explain: CTV_COMMISSION_UX.cancelled.explain,
        hint: `${stats.cancelled?.count || 0} dòng`,
        count: stats.cancelled?.count || 0,
        always: false,
      },
    ].filter((c) => c.count > 0);
    return [...core, ...extras];
  }, [stats, holdDays]);

  const m = overview?.metrics;
  const kpi = m
    ? [
        { label: "Số lần nhấp chuột", value: formatCompact(m.clicks) },
        { label: "Đơn hàng", value: formatCompact(m.orders) },
        { label: "Số lượng đã bán", value: formatCompact(m.qtySold) },
        { label: "Doanh số", value: formatMoneyCompact(m.gmv) },
        { label: "Hoa hồng ước tính", value: formatMoneyCompact(m.estimatedCommission) },
        { label: "Người mua", value: formatCompact(m.buyers) },
      ]
    : [];

  const err = statsQ.error || overviewQ.error;
  const loading = (statsQ.isLoading || overviewQ.isLoading) && !stats && !overview;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">Tổng quan</h1>
        <Select
          className="min-w-[220px]"
          value={`${dateRange.from}|${dateRange.to}`}
          onChange={(v) => {
            const [from, to] = String(v).split("|");
            setDateRange({ from, to });
          }}
          options={[monthRange(0), monthRange(-1)].map((r) => ({
            value: `${r.from}|${r.to}`,
            label: r.label,
          }))}
        />
      </div>

      {err ? (
        <Alert
          type="error"
          showIcon
          message={(err as Error).message || "Không tải được dữ liệu"}
        />
      ) : null}

      <Card title="Các chỉ số chính" className="shadow-sm">
        {kpi.length ? (
          <Row gutter={[12, 12]}>
            {kpi.map((c) => (
              <Col key={c.label} xs={12} md={8} lg={4}>
                <Card size="small" className="h-full bg-[#FFFDF8]">
                  <Statistic title={c.label} value={c.value} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="Chưa có chỉ số trong kỳ" />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Doanh thu & hoa hồng theo ngày" className="shadow-sm">
            <DailySpark data={daily} range={dateRange} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Tỷ lệ chuyển đổi" className="h-full shadow-sm">
            <ConversionCard
              clicks={m?.clicks || 0}
              orders={m?.orders || 0}
            />
          </Card>
        </Col>
      </Row>

      {statusCards.length ? (
        <div>
          <h2 className="mb-3 text-sm font-extrabold text-[#163A2A]">
            Tiền hoa hồng đang ở đâu
          </h2>
          <Row gutter={[12, 12]}>
            {statusCards.map((c) => (
              <Col key={c.key} xs={24} sm={12} lg={6}>
                <Card size="small" className="bg-[#FFFDF8] shadow-sm">
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
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ) : null}
    </div>
  );
}
