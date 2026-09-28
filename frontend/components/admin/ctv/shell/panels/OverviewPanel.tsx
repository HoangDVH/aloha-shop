"use client";

import Link from "next/link";
import React from "react";
import { Alert, Button, Card, Col, Empty, Row } from "antd";
import {
  Coins,
  MousePointerClick,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { useCtvOverview } from "../../ctvQueries";
import { formatVnd } from "../../shared/format";
import {
  AdminRefreshingBadge,
  CtvOverviewSkeleton,
} from "@/components/admin/ui/AdminSkeleton";
import { KpiCard } from "../widgets/KpiCard";
import { DailySpark } from "../widgets/DailySpark";
import { ConversionCard } from "../widgets/ConversionCard";

export function OverviewPanel({
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
