"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Table, App } from "antd";
import { Check, ChevronDown, ChevronUp, Copy, Edit, Plus } from "lucide-react";
import dayjs from "dayjs";
import { formatVnd } from "@/lib/api";
import { shippingRegionLabel, type PromotionItem } from "../form/promotionFormModel";
import { PromotionStatusText } from "./statusTags";
import type { RedemptionLog } from "./types";

type Props = {
  record: PromotionItem;
  onEdit: (record: PromotionItem) => void;
  onDuplicate: (record: PromotionItem) => void;
  onManageCodes: (record: PromotionItem) => void;
  allRedemptions: RedemptionLog[];
};

type SubTab = "info" | "codes" | "orders";

function SubTabButton(props: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  countClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`pb-2.5 font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
        props.active
          ? "border-b-2 border-[#2D5A27] text-[#2D5A27] font-semibold"
          : "text-slate-600 hover:text-[#2D5A27]"
      }`}
    >
      <span>{props.label}</span>
      {props.count ? (
        <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${props.countClass}`}>
          {props.count}
        </span>
      ) : null}
    </button>
  );
}

function targetCustomerLabel(t: PromotionItem["targetCustomer"]): string {
  if (t === "new_web") return "Khách mới web";
  if (t === "wholesale") return "Khách sỉ";
  if (t === "retail") return "Khách lẻ";
  return "Tất cả nhóm khách hàng";
}

function discountLabel(r: PromotionItem): string {
  return r.discountType === "percentage"
    ? `${r.discountValue}%`
    : (r.discountValue || 0).toLocaleString("vi-VN");
}

function SummaryBox({ record }: { record: PromotionItem }) {
  const used = record.usedCount || 0;
  const items: [string, string][] = [
    [
      "Số lượng voucher",
      record.usageLimitTotal != null ? record.usageLimitTotal.toLocaleString("vi-VN") : "∞",
    ],
    ["Đã phát hành", (used + (record.heldCount || 0)).toLocaleString("vi-VN")],
    ["Đã sử dụng", used.toLocaleString("vi-VN")],
    [
      "Giá trị sử dụng",
      record.budgetUsed != null
        ? record.budgetUsed.toLocaleString("vi-VN")
        : (used * (record.discountValue || 0)).toLocaleString("vi-VN"),
    ],
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700 flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map(([label, value], i) => (
        <span key={label} className="contents">
          {i > 0 ? <span className="text-slate-300">|</span> : null}
          <div>
            <span className="text-slate-500">{label}: </span>
            <strong className={`text-slate-900 ${i === 3 ? "font-mono" : ""}`}>{value}</strong>
          </div>
        </span>
      ))}
    </div>
  );
}

function ConditionBox({ record }: { record: PromotionItem }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
      <div
        className="flex items-center justify-between font-bold text-slate-800 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>Điều kiện mua hàng</span>
        <span className="text-slate-400">
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </span>
      </div>
      {!collapsed && (
        <div className="text-slate-600 space-y-1.5 pt-1">
          <div>
            {record.minOrderThreshold ? (
              <span>
                Tổng tiền hàng tối thiểu từ{" "}
                <strong>{(record.minOrderThreshold || 0).toLocaleString("vi-VN")}</strong>
              </span>
            ) : (
              <span>Không yêu cầu giá trị đơn hàng tối thiểu</span>
            )}
          </div>
          {record.maxDiscountVnd ? (
            <div>
              Mức giảm tối đa: <strong>{formatVnd(record.maxDiscountVnd)}</strong>
            </div>
          ) : null}
          <div>
            Phạm vi áp dụng:{" "}
            <strong>
              {record.scope === "product"
                ? `${record.productMas?.length || 0} sản phẩm chỉ định`
                : "Toàn bộ hàng hóa"}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoPanel({ record, onEdit, onDuplicate }: Props) {
  const cols: [string, string, string][] = [
    [
      "Hiệu lực",
      `${record.startDate ? dayjs(record.startDate).format("DD/MM/YYYY") : "—"} - ${
        record.endDate ? dayjs(record.endDate).format("DD/MM/YYYY") : "Vô thời hạn"
      }`,
      "font-medium",
    ],
    ["Mệnh giá", discountLabel(record), "font-semibold"],
    [
      "Chi nhánh",
      record.benefitType === "shipping" && record.regionId
        ? shippingRegionLabel(record.regionId)
        : "Toàn hệ thống",
      "font-medium",
    ],
    ["Nhóm khách hàng", targetCustomerLabel(record.targetCustomer), "font-medium"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-base font-bold text-slate-900">{record.name}</span>
        <span className="text-sm font-semibold text-slate-600 font-mono">{record.id}</span>
        <PromotionStatusText status={record.status} draftLabel="Bản nháp" />
      </div>
      <SummaryBox record={record} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
        {cols.map(([label, value, weight]) => (
          <div key={label}>
            <div className="text-slate-500">{label}</div>
            <div className={`mt-1 ${weight} text-slate-800`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-slate-500">Người tạo giao dịch</div>
          <div className="mt-1 font-medium text-slate-800">Tất cả người tạo giao dịch</div>
        </div>
      </div>
      <ConditionBox record={record} />
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Edit size={13} className="text-slate-400" />
        <span>{record.description || record.title || "Chưa có ghi chú"}</span>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={() => onDuplicate(record)}
          className="flex items-center gap-1.5 px-3 !h-8 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-colors"
        >
          <Copy size={13} className="text-slate-500" />
          <span>Sao chép</span>
        </button>
        <button
          type="button"
          onClick={() => onEdit(record)}
          className="flex items-center gap-1.5 px-4 !h-8 rounded-lg bg-[#2D5A27] text-white text-xs font-semibold hover:bg-[#23481e] cursor-pointer shadow-xs transition-colors"
        >
          <Edit size={13} />
          <span>Chỉnh sửa</span>
        </button>
      </div>
    </div>
  );
}

function CodesPanel(props: {
  record: PromotionItem;
  codes: any[];
  loading: boolean;
  onManageCodes: (r: PromotionItem) => void;
}) {
  const { message } = App.useApp();
  const { record, codes, loading, onManageCodes } = props;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    message.success(`Đã sao chép mã: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  const emptyBox = "py-6 text-center text-slate-400 bg-white rounded border border-dashed border-slate-200";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-600 font-medium">
          Danh sách mã voucher phát hành cho đợt này ({codes.length} mã)
        </div>
        <Button
          type="primary"
          className="!h-8 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] text-xs font-semibold text-white px-3"
          icon={<Plus size={13} />}
          onClick={() => onManageCodes(record)}
        >
          + Tạo mã voucher
        </Button>
      </div>
      {loading ? (
        <div className="py-6 text-center text-slate-400">Đang tải mã voucher...</div>
      ) : codes.length === 0 ? (
        <div className={emptyBox}>Chưa có mã voucher nào được tạo cho đợt này.</div>
      ) : (
        <Table
          size="small"
          dataSource={codes}
          rowKey="code"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Mã voucher",
              dataIndex: "code",
              key: "code",
              render: (v: string) => (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {v}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={
                      copiedCode === v ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )
                    }
                    onClick={() => copyCode(v)}
                  />
                </div>
              ),
            },
            {
              title: "Khách gán",
              dataIndex: "assignedBuyerPhone",
              key: "assignedBuyerPhone",
              render: (v?: string) => v || <span className="text-slate-400">Dùng chung</span>,
            },
            {
              title: "Lượt dùng",
              key: "usage",
              render: (_: any, r: any) => (
                <span>
                  {r.usedCount || 0} / {r.maxUses || "∞"}
                </span>
              ),
            },
            {
              title: "Hạn dùng",
              dataIndex: "expiresAt",
              key: "expiresAt",
              render: (v?: string) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "Vô thời hạn"),
            },
            {
              title: "Trạng thái",
              dataIndex: "active",
              key: "active",
              render: (active: boolean) =>
                active ? (
                  <span className="text-emerald-600 font-semibold text-[11px]">Sẵn sàng</span>
                ) : (
                  <span className="text-slate-400 text-[11px]">Đã khóa</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

function OrdersPanel({ redemptions }: { redemptions: RedemptionLog[] }) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-600 font-medium">
        Đơn hàng đã áp dụng voucher của đợt này ({redemptions.length} đơn)
      </div>
      {redemptions.length === 0 ? (
        <div className="py-6 text-center text-slate-400 bg-white rounded border border-dashed border-slate-200">
          Chưa có đơn hàng nào sử dụng voucher của đợt này.
        </div>
      ) : (
        <Table
          size="small"
          dataSource={redemptions}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Mã đơn hàng",
              dataIndex: "orderCode",
              key: "orderCode",
              render: (v: string) => <strong className="font-mono text-[#2D5A27]">{v}</strong>,
            },
            {
              title: "Tiền giảm",
              dataIndex: "discountAmount",
              key: "discountAmount",
              render: (v: number) => (
                <strong className="text-emerald-700">-{formatVnd(v || 0)}</strong>
              ),
            },
            {
              title: "Khách hàng",
              dataIndex: "buyerPhone",
              key: "buyerPhone",
              render: (v: string) => v || "Khách lẻ",
            },
            {
              title: "Thời gian",
              dataIndex: "createdAt",
              key: "createdAt",
              render: (d: string) => dayjs(d).format("DD/MM/YYYY HH:mm"),
            },
            {
              title: "Trạng thái",
              dataIndex: "status",
              key: "status",
              render: (st: string) =>
                st === "used" ? "Đã thanh toán" : st === "held" ? "Đang giữ" : "Giải phóng",
            },
          ]}
        />
      )}
    </div>
  );
}

/** Chi tiết đợt phát hành bung ngay dưới dòng (kiểu KiotViet). */
export function VoucherDetailRow(props: Props) {
  const { record, allRedemptions, onManageCodes } = props;
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("info");
  const [codes, setCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);

  useEffect(() => {
    if (activeSubTab !== "codes" || !record.id) return;
    let cancelled = false;
    setLoadingCodes(true);
    fetch(`/api/shop/admin/promotions/${record.id}/codes`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setCodes(data.codes || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingCodes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSubTab, record.id]);

  const matchingRedemptions = useMemo(
    () => allRedemptions.filter((r) => r.promotionId === record.id),
    [allRedemptions, record.id]
  );

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200/90 shadow-xs space-y-4 text-xs my-1">
      <div className="flex items-center gap-6 border-b border-slate-200 text-sm">
        <SubTabButton
          active={activeSubTab === "info"}
          onClick={() => setActiveSubTab("info")}
          label="Thông tin"
        />
        <SubTabButton
          active={activeSubTab === "codes"}
          onClick={() => setActiveSubTab("codes")}
          label="Danh sách voucher"
          count={codes.length}
          countClass="bg-emerald-50 text-[#2D5A27] border border-emerald-200/80"
        />
        <SubTabButton
          active={activeSubTab === "orders"}
          onClick={() => setActiveSubTab("orders")}
          label="Đơn hàng dùng voucher"
          count={matchingRedemptions.length}
          countClass="bg-slate-100 text-slate-700"
        />
      </div>
      {activeSubTab === "info" && <InfoPanel {...props} />}
      {activeSubTab === "codes" && (
        <CodesPanel
          record={record}
          codes={codes}
          loading={loadingCodes}
          onManageCodes={onManageCodes}
        />
      )}
      {activeSubTab === "orders" && <OrdersPanel redemptions={matchingRedemptions} />}
    </div>
  );
}
