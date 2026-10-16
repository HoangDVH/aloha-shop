"use client";

import { useMemo } from "react";
import { Alert, Card, Col, Empty, Row, Select, Spin } from "antd";
import { DailySpark } from "../charts/DailySpark";
import { ConversionCard } from "../charts/ConversionCard";
import { useCtvMeOverview } from "../ctvPortalQueries";
import { useCtvPortalUiStore } from "../ctvPortalUiStore";
import {
  dayKeyFromIso,
  formatCompact,
  formatMoneyCompact,
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
  const overviewQ = useCtvMeOverview(dateRange.from, dateRange.to, {
    refetchInterval: visibleRefetchInterval(30_000),
  });

  const overview = overviewQ.data;
  const daily = useMemo(() => deriveDaily(overview), [overview]);

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

  const err = overviewQ.error;
  const loading = overviewQ.isLoading && !overview;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="ctv-page-flow flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">Tổng quan</h1>
          <p className="mt-0.5 text-xs text-slate-500">Hiệu quả bán hàng và hoa hồng CTV</p>
        </div>
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

      {kpi.length ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {kpi.map((c) => (
            <div
              key={c.label}
              className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <span className="text-xs font-semibold text-slate-500">{c.label}</span>
              <span className="mt-2 text-xl font-black tracking-tight text-[#163A2A]">
                {c.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl border border-slate-200/80 shadow-sm">
          <Empty description="Chưa có chỉ số trong kỳ" />
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<span className="font-bold text-slate-800">Doanh thu & hoa hồng theo ngày</span>}
            className="rounded-xl border border-slate-200/80 shadow-sm"
          >
            <DailySpark data={daily} range={dateRange} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span className="font-bold text-slate-800">Tỷ lệ chuyển đổi</span>}
            className="h-full rounded-xl border border-slate-200/80 shadow-sm"
          >
            <ConversionCard
              clicks={m?.clicks || 0}
              orders={m?.orders || 0}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
