"use client";

import { useMemo } from "react";
import { Button, Tag, Tooltip } from "antd";
import {
  FileText,
  Package,
  Printer,
  Trash2,
  Phone,
  MapPin,
  AlertTriangle,
  Info,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import { type PrintableOrder, resolveOrderAddress } from "./OrderPrintModal";
import { PaymentVerificationNotice } from "./PaymentVerificationNotice";

const PAYMENT: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Chưa thanh toán", color: "orange" },
  processing: { label: "Đang xử lý", color: "blue" },
  paid: { label: "Đã thanh toán", color: "green" },
  underpaid: { label: "Thiếu tiền", color: "red" },
  expired: { label: "Hết hạn", color: "default" },
  cancelled: { label: "Đã huỷ", color: "default" },
  failed: { label: "Lỗi thanh toán", color: "red" },
  cod: { label: "COD", color: "cyan" },
};

export type OrderDetailsExpandedProps = {
  order: PrintableOrder & {
    kvPaymentVerification?: { state: string; reason: string; attempts: number };
    statusValue?: string;
    isTest?: boolean;
    voidTestBlock: string | null;
  };
  onPrintReceipt: () => void;
  onPrintShipping: () => void;
  onCheckWholesale?: () => void;
  onVoidTest?: () => void;
};

export function OrderDetailsExpanded({
  order,
  onPrintReceipt,
  onPrintShipping,
  onCheckWholesale,
  onVoidTest,
}: OrderDetailsExpandedProps) {
  const fullAddress = useMemo(() => resolveOrderAddress(order), [order]);

  // Chuẩn hoá danh sách mặt hàng
  const items = useMemo(() => {
    if (order.orderDetails && order.orderDetails.length > 0) {
      return order.orderDetails.map((it) => {
        const quantity = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const discount = Number(it.discount) || 0;
        const sellPrice = Math.max(0, price - discount);
        const lineTotal = sellPrice * quantity;
        return {
          productCode: it.productCode || "SP",
          productName: it.productName || "Sản phẩm",
          quantity,
          price,
          discount,
          sellPrice,
          lineTotal,
          variantLabel: it.variantLabel || "",
          isGift: Boolean(it.isGift),
        };
      });
    }
    return [
      {
        productCode: order.code,
        productName: "Đơn hàng web tổng hợp",
        quantity: 1,
        price: order.total,
        discount: 0,
        sellPrice: order.total,
        lineTotal: order.total,
        variantLabel: "",
        isGift: false,
      },
    ];
  }, [order]);

  // Tạm tính tiền hàng
  const subtotal = useMemo(() => {
    if (order.subtotal) return order.subtotal;
    return items.reduce((sum, it) => sum + it.lineTotal, 0);
  }, [order, items]);

  const p = PAYMENT[order.paymentStatus] || { label: order.paymentStatus, color: "default" };

  return (
    <div className="bg-[#fcfdfc] border-l-4 border-[#2D5A27] border-y border-slate-200/90 p-4 -mx-4 -my-2.5 space-y-4 rounded-r-lg shadow-inner">
      {/* 1. Header Tabs chuẩn KiotViet */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-6 text-xs font-bold">
          <span className="text-[#2D5A27] border-b-2 border-[#2D5A27] pb-2 -mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <FileText size={14} />
            <span>Thông tin đơn hàng ({items.length} mặt hàng)</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Mã đơn KiotViet:</span>
          <span className="font-bold text-[#2D5A27]">
            {order.kvOrderCode || "Chưa đồng bộ"}
          </span>
          {order.kvInvoiceCode ? (
            <span className="text-slate-400 font-medium ml-2">
              (HĐ: {order.kvInvoiceCode})
            </span>
          ) : null}
        </div>
      </div>

      {/* 2. Bảng chi tiết hàng hoá chuẩn KiotViet (Mã hàng | Tên hàng | Số lượng | Đơn giá | Giảm giá | Giá bán | Thành tiền) */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
              <th className="py-2.5 px-3 w-32">Mã hàng</th>
              <th className="py-2.5 px-3">Tên hàng</th>
              <th className="py-2.5 px-3 text-center w-24">Số lượng</th>
              <th className="py-2.5 px-3 text-right w-28">Đơn giá</th>
              <th className="py-2.5 px-3 text-right w-24">Giảm giá</th>
              <th className="py-2.5 px-3 text-right w-28">Giá bán</th>
              <th className="py-2.5 px-3 text-right w-32">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70 transition">
                <td className="py-2.5 px-3 font-bold text-[#2D5A27]">
                  {it.productCode}
                </td>
                <td className="py-2.5 px-3 text-slate-800">
                  <div className="font-semibold uppercase tracking-tight">
                    {it.productName}
                  </div>
                  {it.variantLabel ? (
                    <div className="text-[11px] text-slate-500 font-normal">
                      Phân loại: {it.variantLabel}
                    </div>
                  ) : null}
                  {it.isGift ? (
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      Quà tặng
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                  <span>{it.quantity}</span>
                  <span className="text-red-500 font-normal">/0</span>
                </td>
                <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                  {it.price.toLocaleString("vi-VN")}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                  {it.discount.toLocaleString("vi-VN")}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-700 font-medium tabular-nums">
                  {it.sellPrice.toLocaleString("vi-VN")}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                  {it.lineTotal.toLocaleString("vi-VN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Khối 2 cột: Thông tin giao nhận & Tóm tắt thanh toán */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cột trái: Thông tin người mua & giao nhận */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
          <div className="font-bold text-slate-800 text-[13px] border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#2D5A27]" />
            <span>Thông tin giao nhận</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Khách hàng:</span>
              <span className="font-semibold text-slate-900">
                {order.customerName || "Khách lẻ"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Số điện thoại:</span>
              {order.customerPhone ? (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="inline-flex items-center gap-1 font-semibold text-[#2D5A27] hover:underline"
                >
                  <Phone size={12} />
                  <span>{order.customerPhone}</span>
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            <div className="flex justify-between items-start gap-2 pt-0.5">
              <span className="text-slate-500 shrink-0">Địa chỉ:</span>
              <span className="text-slate-700 text-right font-medium leading-relaxed">
                {fullAddress}
              </span>
            </div>
            {order.notes ? (
              <div className="flex justify-between items-start gap-2 pt-0.5 border-t border-slate-100">
                <span className="text-slate-500 shrink-0">Ghi chú:</span>
                <span className="text-slate-700 italic text-right">
                  {order.notes}
                </span>
              </div>
            ) : null}

            {/* Cảnh báo KiotViet nếu có */}
            {order.kvDeliveryAddress?.state === "needs_review" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 flex items-start gap-1.5 mt-2">
                <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
                <span>{order.kvDeliveryAddress.reason || "Cần xác nhận lại địa chỉ 2 cấp KiotViet"}</span>
              </div>
            ) : null}
            {["unpaid", "processing", "underpaid", "expired", "failed"].includes(order.paymentStatus) &&
            order.kvPaymentVerification?.state === "pending" ? (
              <div className="pt-1">
                <PaymentVerificationNotice
                  code={order.code}
                  reason={order.kvPaymentVerification.reason}
                  attempts={order.kvPaymentVerification.attempts}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Cột phải: Chi tiết thanh toán */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
          <div className="font-bold text-slate-800 text-[13px] border-b border-slate-100 pb-1.5 flex items-center justify-between">
            <span>Chi tiết thanh toán</span>
            <Tag color={p.color} className="mr-0 text-xs font-semibold">
              {p.label}
            </Tag>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="flex justify-between items-center text-slate-600">
              <span>Tổng tiền hàng:</span>
              <span className="font-medium tabular-nums">{formatVnd(subtotal)}</span>
            </div>
            {order.discountAmount || order.voucherDiscount ? (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Giảm giá / Voucher:</span>
                <span className="font-semibold tabular-nums">
                  -{formatVnd(order.discountAmount || order.voucherDiscount || 0)}
                </span>
              </div>
            ) : null}
            {order.shippingFee ? (
              <div className="flex justify-between items-center text-slate-600">
                <span>Phí vận chuyển:</span>
                <span className="font-medium tabular-nums">+{formatVnd(order.shippingFee)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-sm">Khách cần trả:</span>
              <span className="font-black text-base text-[#2D5A27] tabular-nums">
                {formatVnd(order.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Thanh công cụ nút bấm hành động (Toolbar KiotViet) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 bg-white p-3 rounded-xl border">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Info size={14} className="text-slate-400" />
          <span>Bấm lại vào dòng đơn hàng để thu gọn chi tiết</span>
        </div>

        <div className="flex items-center gap-2">
          {order.priceMode === "si" && onCheckWholesale ? (
            <Button size="middle" onClick={onCheckWholesale}>
              Kiểm tra sỉ
            </Button>
          ) : null}

          {onVoidTest ? (
            order.voidTestBlock ? (
              <Tooltip title={order.voidTestBlock}>
                <span>
                  <Button size="middle" disabled icon={<Trash2 size={14} />}>
                    Huỷ đơn test
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button
                size="middle"
                danger
                icon={<Trash2 size={14} />}
                onClick={onVoidTest}
              >
                Huỷ đơn test KiotViet
              </Button>
            )
          ) : null}

          <Button
            size="middle"
            icon={<Package size={14} />}
            onClick={onPrintShipping}
            className="font-medium"
          >
            In phiếu gửi A6
          </Button>

          <Button
            type="primary"
            size="middle"
            icon={<Printer size={14} />}
            onClick={onPrintReceipt}
            className="!bg-[#2D5A27] hover:!bg-[#23471f] font-semibold shadow-xs"
          >
            In hoá đơn K80
          </Button>
        </div>
      </div>
    </div>
  );
}
