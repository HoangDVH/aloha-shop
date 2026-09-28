"use client";

import Link from "next/link";
import React from "react";
import { Button, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import { toast } from "@/components/admin/toast";
import type {
  useClearCommissionFlag,
  useConfirmCommissionFraud,
} from "../../ctvQueries";
import {
  formatDt,
  formatFraudFlags,
  formatVnd,
  periodFromIso,
} from "../../shared/format";
import { statusTag } from "../format";

export function getCommissionLinesColumns({
  clearFlag,
  confirmFraud,
}: {
  clearFlag: ReturnType<typeof useClearCommissionFlag>;
  confirmFraud: ReturnType<typeof useConfirmCommissionFraud>;
}): ColumnsType<any> {
  return [
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
                    onError: (e: unknown) => toast.error((e as Error).message),
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
                    onError: (e: unknown) => toast.error((e as Error).message),
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
  ];
}
