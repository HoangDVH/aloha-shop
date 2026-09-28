"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Table } from "antd";
import { useCtvCommissions } from "../../ctvQueries";
import { formatVnd } from "../../shared/format";
import { statusTag } from "../format";
import { CtvPagination } from "../../shared/CtvPagination";
import {
  AdminRefreshingBadge,
  AdminTableSkeleton,
} from "@/components/admin/ui/AdminSkeleton";

export function OrdersPanel() {
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
          {/* Mobile Card Feed (< md) */}
          <div className="space-y-3 md:hidden">
            {pageRows.map((r, i) => (
              <div
                key={`${r.orderCode}-${r.ctvCode}`}
                className="rounded-xl border border-[#e8ece8] bg-white p-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#f1f4f1] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#2D5A27]">
                    <span className="text-xs text-slate-400">#{(page - 1) * pageSize + i + 1}</span>
                    <span>#{r.orderCode}</span>
                  </div>
                  {statusTag(r.status)}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">CTV:</span>{" "}
                    <span className="font-semibold text-slate-800">{r.ctvCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Số dòng HH:</span>{" "}
                    <span className="font-semibold text-slate-800">{r.n}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Doanh thu:</span>{" "}
                    <span className="font-semibold text-slate-800">{formatVnd(r.lineTotal)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Hoa hồng:</span>{" "}
                    <span className="font-bold text-[#2D5A27]">{formatVnd(r.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block">
            <Table
              size="middle"
              rowKey={(r) => `${r.orderCode}-${r.ctvCode}`}
              dataSource={pageRows}
              pagination={false}
              scroll={{ x: 720 }}
              columns={[
                {
                  title: "#",
                  width: 48,
                  fixed: "left" as const,
                  render: (_: unknown, __: unknown, i: number) =>
                    (page - 1) * pageSize + i + 1,
                },
                {
                  title: "Đơn hàng",
                  dataIndex: "orderCode",
                  fixed: "left" as const,
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
          </div>
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
