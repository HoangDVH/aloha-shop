"use client";

import { Button, Tag, Tooltip } from "antd";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import dayjs from "dayjs";
import { formatVnd } from "@/lib/api";
import { mysteryValueText, type PromotionItem } from "../form/promotionFormModel";
import { DotPill, PromotionStatusText } from "./statusTags";
import type { AllCodeItem } from "./types";

const dateCell = (v?: string, empty = "—") => (
  <span className="text-xs text-slate-600">{v ? dayjs(v).format("DD/MM/YYYY") : empty}</span>
);

/** Cột bảng đợt phát hành (khớp giao diện KiotViet). */
export function promotionColumns(expandedRowKeys: string[]) {
  return [
    {
      title: "Mã đợt phát hành",
      key: "id",
      width: 160,
      render: (_: any, r: PromotionItem) => (
        <span className="font-mono font-medium text-xs text-slate-800">{r.id}</span>
      ),
    },
    {
      title: "Tên đợt phát hành",
      key: "name",
      render: (_: any, r: PromotionItem) => (
        <span className="font-medium text-slate-800 text-xs">{r.name}</span>
      ),
    },
    {
      title: "Từ ngày",
      key: "startDate",
      width: 130,
      render: (_: any, r: PromotionItem) => dateCell(r.startDate),
    },
    {
      title: "Đến ngày",
      key: "endDate",
      width: 130,
      render: (_: any, r: PromotionItem) => dateCell(r.endDate),
    },
    {
      title: "Số lượng",
      key: "quantity",
      width: 110,
      align: "center" as const,
      render: (_: any, r: PromotionItem) => (
        <span className="text-xs font-semibold text-slate-800">
          {r.usageLimitTotal != null ? r.usageLimitTotal.toLocaleString("vi-VN") : "∞"}
        </span>
      ),
    },
    {
      title: "Mệnh giá",
      key: "discountValue",
      width: 130,
      align: "right" as const,
      render: (_: any, r: PromotionItem) => (
        <span className="text-xs font-semibold text-slate-800">
          {mysteryValueText(r) ||
            (r.discountType === "percentage"
              ? `${r.discountValue}%`
              : (r.discountValue || 0).toLocaleString("vi-VN"))}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 140,
      render: (_: any, r: PromotionItem) => (
        <PromotionStatusText status={r.status} draftLabel="Chưa kích hoạt" inlineBlock />
      ),
    },
    {
      title: "",
      key: "toggle",
      width: 48,
      align: "center" as const,
      render: (_: any, r: PromotionItem) => (
        <span className="text-slate-400">
          {expandedRowKeys.includes(r.id) ? (
            <ChevronUp size={16} className="text-[#2D5A27]" />
          ) : (
            <ChevronDown size={16} />
          )}
        </span>
      ),
    },
  ];
}

/** Cột bảng "Danh sách mã Voucher". */
export function allCodesColumns(copiedCode: string | null, onCopy: (code: string) => void) {
  return [
    {
      title: "Mã giảm giá",
      key: "code",
      render: (_: any, r: AllCodeItem) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-dashed border-slate-300">
            {r.code}
          </span>
          <Tooltip title={copiedCode === r.code ? "Đã sao chép" : "Sao chép mã"}>
            <Button
              size="small"
              type="text"
              icon={
                copiedCode === r.code ? (
                  <Check size={13} className="text-emerald-600" />
                ) : (
                  <Copy size={13} className="text-slate-400 hover:text-slate-700" />
                )
              }
              onClick={() => onCopy(r.code)}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Đợt phát hành / Chương trình",
      key: "promotion",
      render: (_: any, r: AllCodeItem) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">{r.promotionName}</div>
          {r.promotionTitle ? (
            <div className="text-[11px] text-slate-400">{r.promotionTitle}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Mức giảm",
      key: "discount",
      render: (_: any, r: AllCodeItem) => (
        <div className="font-bold text-[var(--aloha-green)] text-xs">
          {r.discountType === "percentage" ? `${r.discountValue}%` : formatVnd(r.discountValue || 0)}
          {r.maxDiscountVnd ? (
            <span className="block text-[10px] font-normal text-slate-400">
              Tối đa {formatVnd(r.maxDiscountVnd)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: "Lượt dùng",
      key: "usage",
      render: (_: any, r: AllCodeItem) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{r.usedCount || 0}</span>
          {r.heldCount ? <span className="text-amber-600"> (+{r.heldCount} giữ)</span> : null}
          <span className="text-slate-400"> / {r.maxUses ? r.maxUses : "∞"}</span>
        </div>
      ),
    },
    {
      title: "Khách chỉ định",
      key: "buyer",
      render: (_: any, r: AllCodeItem) =>
        r.assignedBuyerPhone ? (
          <Tag color="cyan" className="font-mono text-xs">
            {r.assignedBuyerPhone}
          </Tag>
        ) : (
          <span className="text-slate-400 text-xs">Dùng chung</span>
        ),
    },
    {
      title: "Hạn dùng",
      key: "expiresAt",
      render: (_: any, r: AllCodeItem) =>
        r.expiresAt ? (
          <span className="text-xs text-slate-600">{dayjs(r.expiresAt).format("DD/MM/YYYY HH:mm")}</span>
        ) : (
          <span className="text-xs text-slate-400">Vô thời hạn</span>
        ),
    },
    {
      title: "Trạng thái",
      key: "active",
      render: (_: any, r: AllCodeItem) =>
        r.active ? <DotPill tone="green">Sẵn sàng</DotPill> : <DotPill tone="gray">Tạm khóa</DotPill>,
    },
  ];
}

/** Cột bảng "Lịch sử sử dụng & Đối soát". */
export const redemptionColumns = [
  {
    title: "Mã đơn hàng",
    dataIndex: "orderCode",
    key: "orderCode",
    render: (v: string) => <span className="font-mono font-bold text-[#2D5A27]">{v}</span>,
  },
  {
    title: "Số tiền đã giảm",
    dataIndex: "discountAmount",
    key: "discountAmount",
    render: (v: number) => (
      <span className="font-bold text-[var(--aloha-green)]">-{formatVnd(v || 0)}</span>
    ),
  },
  {
    title: "Mã chương trình",
    dataIndex: "promotionId",
    key: "promotionId",
    render: (v: string) => <span className="text-xs font-mono text-slate-600">{v}</span>,
  },
  {
    title: "Khách hàng",
    dataIndex: "buyerPhone",
    key: "buyerPhone",
    render: (v: string) => v || <span className="text-slate-400 text-xs">Khách vãng lai</span>,
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    render: (st: string) => {
      if (st === "used") return <DotPill tone="green">Đã hoàn tất</DotPill>;
      if (st === "held") return <DotPill tone="amber">Đang giữ đơn</DotPill>;
      return <DotPill tone="gray">Đã giải phóng</DotPill>;
    },
  },
  {
    title: "Thời gian",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (d: string) => (
      <span className="text-xs text-slate-500">{dayjs(d).format("DD/MM/YYYY HH:mm:ss")}</span>
    ),
  },
];
