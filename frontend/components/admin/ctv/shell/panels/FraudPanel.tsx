"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Space, Table, Tabs, Tag } from "antd";
import { toast } from "@/components/admin/toast";
import {
  useBanCtv,
  useClearCommissionFlag,
  useClearSoftFraudFlags,
  useConfirmCommissionFraud,
  useCtvFraud,
  useReviewFraudEvent,
} from "../../ctvQueries";
import { CtvPagination } from "../../shared/CtvPagination";
import {
  AdminKpiRowSkeleton,
  AdminRefreshingBadge,
  AdminTableSkeleton,
} from "@/components/admin/ui/AdminSkeleton";
import { FraudSettingsCard } from "./FraudSettingsCard";

export function FraudPanel() {
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
      return rows.filter((r: any) => !r.reviewStatus || r.reviewStatus === "open");
    }
    // Gộp rule mới (phone_repeat) + sự kiện cũ (address_match)
    if (filter === "phone_dup") {
      return rows.filter((r: any) => {
        const t = String(r.type || "");
        return t === "phone_repeat" || t === "address_match";
      });
    }
    return rows.filter((r: any) => String(r.type || "") === filter);
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
                onSuccess: (r: any) =>
                  toast.success(`Đã gỡ ${r.modified || 0} dòng`),
                onError: (e: unknown) => toast.error((e as Error).message),
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
            scroll={{ x: 1050 }}
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
                              onError: (e: unknown) =>
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
                            onError: (e: unknown) => toast.error((e as Error).message),
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
                              onError: (e: unknown) =>
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
                            onError: (e: unknown) => toast.error((e as Error).message),
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
