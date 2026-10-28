"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Segmented, Button, message } from "antd";
import { Printer, Check, Share2, X } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { buildVietQrUrl, fetchShopBank, type ShopBankInfo } from "@/lib/bankTransfer";
import {
  type PrintableOrder,
  type PrintItem,
  resolveOrderAddress,
} from "./print/printTypes";
import { ReceiptPreview, ReceiptHiddenPrint } from "./print/ReceiptPrintTemplate";
import { ShippingPreview, ShippingHiddenPrint } from "./print/ShippingPrintTemplate";

export type { PrintableOrder, PrintItem };
export { resolveOrderAddress };

export function OrderPrintModal({
  open,
  order,
  initialMode = "receipt",
  onClose,
}: {
  open: boolean;
  order: PrintableOrder | null;
  initialMode?: "receipt" | "shipping";
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"receipt" | "shipping">(initialMode);
  const [paperSize, setPaperSize] = useState<"k80" | "k58" | "a4">("k80");
  const [bankInfo, setBankInfo] = useState<ShopBankInfo | null>(null);
  const [copiedZalo, setCopiedZalo] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      void fetchShopBank().then(setBankInfo);
    }
  }, [open, initialMode]);

  const fullAddress = useMemo(() => resolveOrderAddress(order), [order]);

  const items = useMemo<PrintItem[]>(() => {
    if (!order?.orderDetails || !order.orderDetails.length) {
      return [
        {
          productCode: order?.code || "SP",
          productName: "Đơn hàng web tổng hợp",
          quantity: 1,
          price: order?.total || 0,
          variantLabel: "",
          isGift: false,
        },
      ];
    }
    return order.orderDetails.map((it) => ({
      productCode: it.productCode || "SP",
      productName: it.productName || "Sản phẩm",
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
      variantLabel: it.variantLabel || "",
      isGift: Boolean(it.isGift),
    }));
  }, [order]);

  const subtotal = useMemo(() => {
    if (order?.subtotal) return order.subtotal;
    return items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  }, [order, items]);

  const qrUrl = useMemo(() => {
    if (!order || !bankInfo?.configured) return null;
    const isPaid = order.paymentStatus === "paid";
    if (isPaid) return null;
    return buildVietQrUrl({
      bin: bankInfo.bin,
      accountNumber: bankInfo.accountNumber,
      accountName: bankInfo.accountName,
      amount: order.total,
      addInfo: order.kvOrderCode || order.code,
    });
  }, [order, bankInfo]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyZalo = async () => {
    if (!order) return;
    const lines = [
      `🌿 ALOHA THẾ GIỚI CHẬU CÂY`,
      `Xác nhận đơn hàng: #${order.kvOrderCode || order.code}`,
      `Khách hàng: ${order.customerName || "Quý khách"}`,
      `SĐT: ${order.customerPhone || "—"}`,
      `Địa chỉ: ${fullAddress}`,
      `--------------------------`,
      ...items.map(
        (it) =>
          `• ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""}: SL ${it.quantity} x ${formatVnd(it.price)}`
      ),
      `--------------------------`,
      `Tổng tiền: ${formatVnd(order.total)}`,
      `Thanh toán: ${order.paymentStatus === "paid" ? "Đã thanh toán" : "Thu hộ COD khi nhận"}`,
      `Cảm ơn Quý khách đã tin tưởng ALOHA!`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedZalo(true);
      message.success("Đã sao chép nội dung đơn hàng để gửi Zalo cho khách!");
      setTimeout(() => setCopiedZalo(false), 2500);
    } catch {
      message.info("Không thể tự động sao chép. Vui lòng thử lại.");
    }
  };

  if (!order) return null;

  const isPaid = order.paymentStatus === "paid";
  const displayCode = order.kvOrderCode || order.code;
  const orderDate = new Date(order.createdAt).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      {/* 1. Modal xem trước trên màn hình */}
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={620}
        centered
        styles={{ body: { padding: 0 } }}
        destroyOnHidden
      >
        <div className="flex flex-col bg-slate-50 rounded-2xl overflow-hidden max-h-[90vh]">
          {/* Header công cụ */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <Segmented
                value={mode}
                onChange={(val) => setMode(val as "receipt" | "shipping")}
                options={[
                  { label: "🧾 Hoá đơn bán lẻ", value: "receipt" },
                  { label: "📦 Phiếu gửi hàng", value: "shipping" },
                ]}
                className="font-semibold text-xs"
              />
              {mode === "receipt" && (
                <Segmented
                  size="small"
                  value={paperSize}
                  onChange={(val) => setPaperSize(val as "k80" | "k58" | "a4")}
                  options={[
                    { label: "K80 (80mm)", value: "k80" },
                    { label: "K58 (58mm)", value: "k58" },
                    { label: "A4 / A5", value: "a4" },
                  ]}
                  className="hidden sm:inline-flex text-[11px]"
                />
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          {/* Khung xem trước bản in (Preview) */}
          <div className="overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-100/80">
            <div
              className={`bg-white shadow-md text-black transition-all ${
                mode === "receipt"
                  ? paperSize === "k58"
                    ? "w-[260px] p-3 text-[11px]"
                    : paperSize === "a4"
                    ? "w-[500px] p-8 text-sm"
                    : "w-[340px] p-4 text-xs font-mono"
                  : "w-[440px] p-5 text-xs border-2 border-dashed border-slate-400 font-sans"
              }`}
            >
              {mode === "receipt" ? (
                <ReceiptPreview
                  order={order}
                  displayCode={displayCode}
                  orderDate={orderDate}
                  fullAddress={fullAddress}
                  items={items}
                  subtotal={subtotal}
                  isPaid={isPaid}
                  qrUrl={qrUrl}
                  bankInfo={bankInfo}
                  paperSize={paperSize}
                />
              ) : (
                <ShippingPreview
                  order={order}
                  displayCode={displayCode}
                  fullAddress={fullAddress}
                  items={items}
                  isPaid={isPaid}
                />
              )}
            </div>
          </div>

          {/* Footer nút bấm hành động */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Printer size={16} className="text-slate-400" />
              <span>Hỗ trợ mọi máy in nhiệt K80/K58, AirPrint và Wi-Fi</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                icon={copiedZalo ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
                onClick={handleCopyZalo}
                className="font-semibold text-xs"
              >
                {copiedZalo ? "Đã copy gửi Zalo" : "Gửi Zalo"}
              </Button>

              <Button
                type="primary"
                icon={<Printer size={15} />}
                onClick={handlePrint}
                className="!bg-[#2D5A27] hover:!bg-[#23481f] font-semibold text-xs h-9 px-5 shadow-sm"
              >
                In ngay (1-Chạm)
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 2. KHU VỰC IN ẨN (CHỈ XUẤT HIỆN KHI BẤM IN) */}
      <div id="aloha-printable-area" className="hidden print:block">
        {mode === "receipt" ? (
          <ReceiptHiddenPrint
            order={order}
            displayCode={displayCode}
            orderDate={orderDate}
            fullAddress={fullAddress}
            items={items}
            subtotal={subtotal}
            isPaid={isPaid}
            qrUrl={qrUrl}
            bankInfo={bankInfo}
            paperSize={paperSize}
          />
        ) : (
          <ShippingHiddenPrint
            order={order}
            displayCode={displayCode}
            fullAddress={fullAddress}
            items={items}
            isPaid={isPaid}
          />
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #aloha-printable-area,
          #aloha-printable-area * {
            visibility: visible !important;
          }
          #aloha-printable-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            z-index: 999999 !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
    </>
  );
}
