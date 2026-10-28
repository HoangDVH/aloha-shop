import { useState } from "react";
import { Dropdown, message, Tooltip } from "antd";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Package,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { OrderDetailsExpandedProps } from "../OrderDetailsExpanded";
import type { OrderItemDetail } from "./OrderProductsTable";

export function OrderFinancialsAndActions({
  order,
  items,
  totalQuantity,
  subtotal,
  fullAddress,
  onPrintReceipt,
  onPrintShipping,
  onCheckWholesale,
  onVoidTest,
  onCollapse,
  onRefresh,
}: {
  order: OrderDetailsExpandedProps["order"];
  items: OrderItemDetail[];
  totalQuantity: number;
  subtotal: number;
  fullAddress: string;
  onPrintReceipt: () => void;
  onPrintShipping: () => void;
  onCheckWholesale?: () => void;
  onVoidTest?: () => void;
  onCollapse?: () => void;
  onRefresh?: () => void;
}) {
  const [orderNotes, setOrderNotes] = useState(order.notes || order.customerNote || "");
  const [syncingKv, setSyncingKv] = useState(false);

  const handleSyncKv = async () => {
    if (syncingKv) return;
    setSyncingKv(true);
    try {
      const res = await fetch(`/api/shop/admin/orders/${encodeURIComponent(order.code)}/sync-kv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Đồng bộ thất bại");
      }
      message.success("Đã đồng bộ thành công từ KiotViet!");
      onRefresh?.();
    } catch (e: any) {
      message.error(e?.message || "Đồng bộ từ KiotViet thất bại");
    } finally {
      setSyncingKv(false);
    }
  };

  const handleCopyOrder = () => {
    const lines = [
      `Mã đơn: ${order.kvOrderCode || order.code}`,
      `Khách hàng: ${order.customerName || "Khách lẻ"} (${order.customerPhone || "Chưa có SĐT"})`,
      `Địa chỉ: ${fullAddress || "Nhận tại cửa hàng"}`,
      `Tổng tiền: ${order.total.toLocaleString("vi-VN")} ₫`,
      `Bảng giá: ${order.priceMode === "si" ? "Bảng giá sỉ" : "Bảng giá Web"}`,
      `Trạng thái: ${
        order.paymentStatus === "paid"
          ? "Hoàn thành"
          : order.paymentStatus === "cancelled"
          ? "Đã huỷ"
          : order.paymentStatus === "cod"
          ? "Thu hộ COD"
          : "Phiếu tạm"
      }`,
    ];
    navigator.clipboard?.writeText(lines.join("\n"));
    message.success("Đã sao chép thông tin đơn hàng!");
  };

  const handleExportOrder = () => {
    const headers = ["Mã đơn", "Mã hàng", "Tên hàng", "Số lượng", "Đơn giá", "Giảm giá", "Thành tiền"];
    const rows = items.map((it) => [
      `"${order.kvOrderCode || order.code}"`,
      `"${it.productCode}"`,
      `"${it.productName}"`,
      it.quantity,
      it.price,
      it.discount,
      it.lineTotal,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DonHang_${order.kvOrderCode || order.code}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success("Đã xuất file đơn hàng!");
  };

  return (
    <div className="pt-2 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Trái: Ghi chú */}
        <div className="lg:col-span-7">
          <textarea
            rows={4}
            placeholder="Ghi chú..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-3 text-[13px] text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 resize-none bg-white shadow-2xs"
          />
        </div>

        {/* Phải: Bảng tài chính */}
        <div className="lg:col-span-5 space-y-2 text-[13px] text-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-800 font-semibold">Tổng tiền hàng ({totalQuantity})</span>
            <span className="tabular-nums font-bold text-slate-900">
              {subtotal.toLocaleString("vi-VN")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-800 font-semibold">Giảm giá phiếu đặt</span>
            <span className="tabular-nums font-semibold text-slate-900">0</span>
          </div>

          {order.shippingFee ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-800 font-semibold">Phí giao hàng</span>
              <span className="tabular-nums font-semibold text-slate-900">
                {order.shippingFee.toLocaleString("vi-VN")}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-[15px] font-black text-slate-900 pt-1 border-t border-slate-200">
            <span>Tổng cộng</span>
            <span className="tabular-nums">{order.total.toLocaleString("vi-VN")}</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-slate-800 font-semibold">Khách đã trả</span>
            <span className="tabular-nums font-bold text-slate-900">
              {(order.paidAmount || (order.paymentStatus === "paid" ? order.total : 0)).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
      </div>

      {/* Thanh công cụ đáy */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-2 sm:gap-4 text-[13px] text-slate-800 font-semibold">
          {onVoidTest ? (
            order.voidTestBlock ? (
              <Tooltip title={order.voidTestBlock}>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 py-1.5 px-2 text-slate-400 cursor-not-allowed font-medium"
                >
                  <Trash2 size={15} />
                  <span>Hủy</span>
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={onVoidTest}
                className="flex items-center gap-1.5 py-1.5 px-2 hover:text-red-600 hover:bg-red-50 rounded transition font-semibold cursor-pointer"
              >
                <Trash2 size={15} />
                <span>Hủy</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => message.info("Đơn hàng không thuộc diện huỷ thử nghiệm.")}
              className="flex items-center gap-1.5 py-1.5 px-2 text-slate-500 hover:text-slate-800 rounded transition font-semibold cursor-pointer"
            >
              <Trash2 size={15} />
              <span>Hủy</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyOrder}
            className="flex items-center gap-1.5 py-1.5 px-2 hover:text-slate-900 hover:bg-slate-100 rounded transition font-semibold cursor-pointer"
          >
            <Copy size={15} />
            <span>Sao chép</span>
          </button>

          <button
            type="button"
            onClick={handleExportOrder}
            className="flex items-center gap-1.5 py-1.5 px-2 hover:text-slate-900 hover:bg-slate-100 rounded transition font-semibold cursor-pointer"
          >
            <ExternalLink size={15} />
            <span>Xuất file</span>
          </button>

          <button
            type="button"
            disabled={syncingKv}
            onClick={handleSyncKv}
            className="flex items-center gap-1.5 py-1.5 px-2 hover:text-[#2D5A27] hover:bg-emerald-50 text-emerald-800 rounded transition font-semibold cursor-pointer disabled:opacity-50"
            title="Đồng bộ lại trạng thái, tiền và hóa đơn từ KiotViet"
          >
            <RefreshCw size={15} className={syncingKv ? "animate-spin" : ""} />
            <span>{syncingKv ? "Đang đồng bộ…" : "Đồng bộ KiotViet"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {order.priceMode === "si" && onCheckWholesale ? (
            <button
              type="button"
              onClick={onCheckWholesale}
              className="px-3.5 py-2 border border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100 rounded text-[13px] font-bold transition cursor-pointer"
            >
              Kiểm tra sỉ
            </button>
          ) : null}

          <button
            type="button"
            onClick={onPrintReceipt}
            className="px-4 py-2 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded text-[13px] font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Check size={16} />
            <span>Xử lý đơn hàng</span>
          </button>

          <button
            type="button"
            onClick={() => message.success("Đã lưu thông tin đơn hàng!")}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded text-[13px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <FileText size={15} />
            <span>Lưu</span>
          </button>

          <button
            type="button"
            onClick={onCollapse}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded text-[13px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <ChevronUp size={15} />
            <span>Kết thúc</span>
          </button>

          <Dropdown
            menu={{
              items: [
                {
                  key: "receipt",
                  label: (
                    <div onClick={onPrintReceipt} className="flex items-center gap-2 py-1 text-[13px] font-semibold text-slate-900">
                      <Printer size={15} />
                      <span>In hoá đơn K80</span>
                    </div>
                  ),
                },
                {
                  key: "shipping",
                  label: (
                    <div onClick={onPrintShipping} className="flex items-center gap-2 py-1 text-[13px] font-semibold text-slate-900">
                      <Package size={15} />
                      <span>In phiếu gửi A6</span>
                    </div>
                  ),
                },
              ],
            }}
            trigger={["click"]}
          >
            <button
              type="button"
              className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded text-[13px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Printer size={15} />
              <span>In</span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
