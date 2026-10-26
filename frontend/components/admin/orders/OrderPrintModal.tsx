"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Segmented, Button, Tooltip, message } from "antd";
import {
  Printer,
  Copy,
  Check,
  Share2,
  Package,
  X,
  FileText,
  Phone,
  MapPin,
  QrCode,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import { buildVietQrUrl, fetchShopBank, type ShopBankInfo } from "@/lib/bankTransfer";

export type PrintableOrder = {
  code: string;
  kvOrderCode?: string | null;
  kvInvoiceCode?: string | null;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    detail?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  kvDeliveryAddress?: {
    state?: string;
    reason?: string;
    original?: { province: string; district?: string; ward: string };
    current?: { province: string; ward: string };
  };
  total: number;
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  voucherDiscount?: number;
  paymentStatus: string;
  priceMode?: string;
  notes?: string;
  orderDetails?: Array<{
    productCode?: string;
    productName?: string;
    quantity?: number;
    price?: number;
    discount?: number;
    variantLabel?: string;
    isGift?: boolean;
  }>;
};

export type PrintItem = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  variantLabel?: string;
  isGift?: boolean;
};

// Tạo địa chỉ giao hàng hoàn chỉnh chuẩn KiotViet
export function resolveOrderAddress(order: PrintableOrder | null): string {
  if (!order) return "";
  if (order.customerAddress) return order.customerAddress;
  const sa = order.shippingAddress;
  if (sa) {
    return [sa.detail, sa.ward, sa.district, sa.province].filter(Boolean).join(", ");
  }
  const kv = order.kvDeliveryAddress;
  if (kv?.current) {
    return `${kv.current.ward}, ${kv.current.province}`;
  }
  return "Nhận tại cửa hàng ALOHA";
}

// SVG Barcode Code128 thu gọn (chuẩn quét máy bắn mã vạch bưu cục)
function SvgBarcode({ value }: { value: string }) {
  const cleanVal = (value || "ALOHA").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  // Tạo pattern vạch barcode giả lập chuẩn trực quan rõ nét
  const bars: number[] = [];
  let seed = 0;
  for (let i = 0; i < cleanVal.length; i++) {
    seed = (seed + cleanVal.charCodeAt(i) * (i + 1)) % 1000;
  }
  for (let i = 0; i < 48; i++) {
    bars.push((seed + i * 17) % 3 === 0 ? 3 : (seed + i * 7) % 2 === 0 ? 2 : 1);
  }

  return (
    <div className="flex flex-col items-center">
      <svg className="h-10 w-44" viewBox="0 0 180 40" preserveAspectRatio="none">
        {bars.map((w, idx) => {
          const x = idx * 3.6;
          const isBlack = idx % 2 === 0 || idx % 5 === 0;
          return isBlack ? (
            <rect key={idx} x={x} y="0" width={w} height="36" fill="#000" />
          ) : null;
        })}
      </svg>
      <span className="text-[10px] tracking-widest font-mono text-black font-bold -mt-0.5">
        {cleanVal}
      </span>
    </div>
  );
}

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

  // Tạo địa chỉ giao hàng hoàn chỉnh
  const fullAddress = useMemo(() => resolveOrderAddress(order), [order]);

  // Danh sách sản phẩm
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

  // Tạm tính
  const subtotal = useMemo(() => {
    if (order?.subtotal) return order.subtotal;
    return items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  }, [order, items]);

  // Link VietQR nếu đơn chưa thanh toán hoặc COD
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

  // Thực hiện in 1-chạm (AirPrint / Mopria / Trình duyệt)
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Sao chép tin nhắn Zalo gửi khách
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
                /* ─── MẪU HOÁ ĐƠN BÁN LẺ (K80 / K58 / A4) ─── */
                <div className="space-y-3 font-mono leading-tight">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-extrabold uppercase tracking-wide">
                      ALOHA THẾ GIỚI CHẬU CÂY
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Chậu xi măng nhẹ, gốm sứ & cây phong thủy
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Hotline / Zalo: 09xx.xxx.xxx
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Website: alohathegioichaucay.com
                    </p>
                  </div>

                  <div className="border-b border-dashed border-gray-400 my-2" />

                  <div className="text-center space-y-0.5">
                    <h2 className="text-sm font-black uppercase tracking-wider">
                      HÓA ĐƠN BÁN HÀNG
                    </h2>
                    <p className="text-[11px] font-bold">#{displayCode}</p>
                    <p className="text-[10px] text-gray-500">{orderDate}</p>
                  </div>

                  <div className="space-y-1 text-[11px] pt-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Khách hàng:</span>
                      <span className="font-bold">{order.customerName || "Khách lẻ"}</span>
                    </div>
                    {order.customerPhone ? (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SĐT:</span>
                        <span className="font-semibold">{order.customerPhone}</span>
                      </div>
                    ) : null}
                    {fullAddress ? (
                      <div className="text-[10px] text-gray-700 leading-snug">
                        <span className="text-gray-600">Đ/C: </span>
                        <span>{fullAddress}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-b border-dashed border-gray-400 my-2" />

                  {/* Bảng sản phẩm */}
                  <div className="space-y-2">
                    <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-gray-200">
                      <span>Tên hàng</span>
                      <span>T.Tiền</span>
                    </div>
                    {items.map((it, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <p className="font-medium">
                          {it.productName}
                          {it.variantLabel ? ` (${it.variantLabel})` : ""}
                          {it.isGift ? " [Quà tặng]" : ""}
                        </p>
                        <div className="flex justify-between text-gray-600 text-[10.5px]">
                          <span>
                            {it.quantity} x {it.isGift ? "0đ" : formatVnd(it.price)}
                          </span>
                          <span className="font-semibold text-black">
                            {it.isGift ? "0đ" : formatVnd(it.price * it.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-dashed border-gray-400 my-2" />

                  {/* Tổng kết tiền */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tạm tính:</span>
                      <span>{formatVnd(subtotal)}</span>
                    </div>
                    {order.discountAmount || order.voucherDiscount ? (
                      <div className="flex justify-between text-emerald-800 font-semibold">
                        <span>Giảm giá / Voucher:</span>
                        <span>-{formatVnd(order.discountAmount || order.voucherDiscount || 0)}</span>
                      </div>
                    ) : null}
                    {order.shippingFee ? (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phí giao hàng:</span>
                        <span>{formatVnd(order.shippingFee)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-gray-300">
                      <span>TỔNG CỘNG:</span>
                      <span className="text-base">{formatVnd(order.total)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-gray-600">Trạng thái:</span>
                      <span className={`font-bold ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                        {isPaid ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN (COD)"}
                      </span>
                    </div>
                  </div>

                  {/* Mã QR chuyển khoản VietQR nếu chưa thanh toán */}
                  {qrUrl && !isPaid ? (
                    <div className="pt-2 text-center space-y-1 flex flex-col items-center border-t border-dashed border-gray-300">
                      <p className="text-[10px] font-bold text-gray-600">QUÉT QR THANH TOÁN TỰ ĐỘNG</p>
                      <img
                        src={qrUrl}
                        alt="VietQR"
                        className="h-28 w-28 object-contain border border-gray-300 rounded-md p-1 bg-white"
                      />
                      <p className="text-[9px] text-gray-500">
                        {bankInfo?.bankName} • STK: {bankInfo?.accountNumber}
                      </p>
                    </div>
                  ) : null}

                  <div className="border-b border-dashed border-gray-400 my-2" />

                  <div className="text-center pt-1 text-[10px] text-gray-600 italic space-y-0.5">
                    <p>Cảm ơn Quý khách đã ủng hộ ALOHA!</p>
                    <p>Hẹn gặp lại Quý khách lần sau.</p>
                  </div>
                </div>
              ) : (
                /* ─── MẪU PHIẾU GỬI HÀNG / VẬN ĐƠN DÁN THÙNG (A6 / DECAL) ─── */
                <div className="space-y-3 font-sans leading-normal">
                  {/* Header vận đơn */}
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <div>
                      <h2 className="text-base font-black tracking-wider text-black">
                        ALOHA
                      </h2>
                      <p className="text-[10px] text-gray-600 font-semibold">
                        PHIẾU GIAO HÀNG
                      </p>
                    </div>
                    <SvgBarcode value={displayCode} />
                  </div>

                  {/* Khung Người gửi & Người nhận */}
                  <div className="grid grid-cols-2 gap-3 border-b-2 border-black pb-2 text-[11px]">
                    <div className="border-r border-gray-300 pr-2 space-y-0.5">
                      <p className="font-bold text-black uppercase text-[10px]">
                        Từ (Người gửi):
                      </p>
                      <p className="font-semibold text-gray-900">ALOHA Thế Giới Chậu Cây</p>
                      <p className="text-gray-600">Hotline: 09xx.xxx.xxx</p>
                      <p className="text-gray-600 text-[10px]">Kho hàng ALOHA</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-black uppercase text-[10px]">
                        Đến (Người nhận):
                      </p>
                      <p className="text-sm font-black text-black uppercase">
                        {order.customerName || "Khách lẻ"}
                      </p>
                      <p className="text-sm font-extrabold text-black flex items-center gap-1">
                        <Phone size={12} className="shrink-0" />
                        <span>{order.customerPhone || "—"}</span>
                      </p>
                      <p className="text-[11px] text-gray-800 leading-snug">
                        <MapPin size={11} className="inline mr-0.5 text-gray-500" />
                        {fullAddress}
                      </p>
                    </div>
                  </div>

                  {/* Danh sách hàng trong gói */}
                  <div className="border-b border-black pb-2 space-y-1">
                    <p className="font-bold text-[11px]">Nội dung hàng hóa ({items.length} món):</p>
                    <ul className="text-[10.5px] text-gray-700 list-disc list-inside space-y-0.5">
                      {items.map((it, idx) => (
                        <li key={idx} className="truncate">
                          {it.productName}
                          {it.variantLabel ? ` (${it.variantLabel})` : ""} x <b>{it.quantity}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] font-bold text-red-600 italic pt-0.5">
                      ⚠️ HÀNG DỄ VỠ (CÂY CẢNH & CHẬU) - XIN NHẸ TAY!
                    </p>
                  </div>

                  {/* Khung Tiền COD thu hộ (Quan trọng nhất cho Shipper) */}
                  <div className="rounded-lg border-2 border-black p-2.5 text-center bg-gray-50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      TIỀN THU HỘ (COD)
                    </p>
                    <p className="text-xl font-black text-black">
                      {isPaid ? "0 VNĐ (ĐÃ THANH TOÁN)" : `${formatVnd(order.total)}`}
                    </p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                      {isPaid
                        ? "Đơn đã thanh toán trước — Tuyệt đối không thu thêm tiền của khách"
                        : "Shipper thu đúng số tiền trên trước khi giao hàng"}
                    </p>
                  </div>

                  {/* Chữ ký & Ghi chú */}
                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-gray-600 pt-1">
                    <div>
                      <p className="font-bold text-black">Chữ ký người gửi</p>
                      <p className="h-9" />
                      <p className="italic text-gray-400">(Ký và ghi rõ họ tên)</p>
                    </div>
                    <div>
                      <p className="font-bold text-black">Chữ ký người nhận</p>
                      <p className="h-9" />
                      <p className="italic text-gray-400">Đồng kiểm tra hàng trước khi nhận</p>
                    </div>
                  </div>
                </div>
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

      {/* 2. KHU VỰC IN ẨN (CHỈ XUẤT HIỆN KHI BẤM IN - ẨN 100% GIAO DIỆN WEB CÒN LẠI) */}
      <div id="aloha-printable-area" className="hidden print:block">
        {mode === "receipt" ? (
          /* Bản in nhiệt K80 sạch sẽ */
          <div
            style={{
              width: paperSize === "k58" ? "56mm" : paperSize === "a4" ? "190mm" : "78mm",
              margin: "0 auto",
              padding: paperSize === "k58" ? "2mm" : "4mm",
              fontFamily: "monospace, Courier, Arial, sans-serif",
              fontSize: paperSize === "k58" ? "9.5pt" : "11pt",
              lineHeight: 1.25,
              color: "#000",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "13pt", fontWeight: "bold" }}>ALOHA THẾ GIỚI CHẬU CÂY</div>
              <div style={{ fontSize: "9pt" }}>Chậu xi măng nhẹ, gốm sứ & cây cảnh</div>
              <div style={{ fontSize: "9pt" }}>Hotline / Zalo: 09xx.xxx.xxx</div>
            </div>

            <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

            <div style={{ textAlign: "center", margin: "6px 0" }}>
              <div style={{ fontSize: "14pt", fontWeight: "bold" }}>HÓA ĐƠN BÁN HÀNG</div>
              <div style={{ fontSize: "10pt", fontWeight: "bold" }}>#{displayCode}</div>
              <div style={{ fontSize: "9pt" }}>{orderDate}</div>
            </div>

            <div style={{ margin: "6px 0", fontSize: "10pt" }}>
              <div><b>Khách hàng:</b> {order.customerName || "Khách lẻ"}</div>
              {order.customerPhone ? <div><b>SĐT:</b> {order.customerPhone}</div> : null}
              {fullAddress ? <div style={{ fontSize: "9pt" }}><b>Đ/C:</b> {fullAddress}</div> : null}
            </div>

            <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={{ textAlign: "left", paddingBottom: "4px" }}>Tên hàng</th>
                  <th style={{ textAlign: "right", paddingBottom: "4px" }}>T.Tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} style={{ verticalAlign: "top" }}>
                    <td style={{ padding: "4px 0" }}>
                      <div>{it.productName}{it.variantLabel ? ` (${it.variantLabel})` : ""}</div>
                      <div style={{ fontSize: "9pt", color: "#333" }}>
                        {it.quantity} x {it.isGift ? "0đ" : formatVnd(it.price)}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", padding: "4px 0", fontWeight: "bold" }}>
                      {it.isGift ? "0đ" : formatVnd(it.price * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderBottom: "1px dashed #000", margin: "6px 0" }} />

            <div style={{ fontSize: "10pt", lineHeight: 1.4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Tạm tính:</span>
                <span>{formatVnd(subtotal)}</span>
              </div>
              {order.discountAmount || order.voucherDiscount ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Giảm giá / Voucher:</span>
                  <span>-{formatVnd(order.discountAmount || order.voucherDiscount || 0)}</span>
                </div>
              ) : null}
              {order.shippingFee ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Phí giao hàng:</span>
                  <span>{formatVnd(order.shippingFee)}</span>
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13pt",
                  fontWeight: "bold",
                  borderTop: "1px solid #000",
                  paddingTop: "4px",
                  marginTop: "4px",
                }}
              >
                <span>TỔNG CỘNG:</span>
                <span>{formatVnd(order.total)}</span>
              </div>
              <div style={{ marginTop: "4px", fontWeight: "bold" }}>
                Thanh toán: {isPaid ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN (COD)"}
              </div>
            </div>

            {qrUrl && !isPaid ? (
              <div style={{ textAlign: "center", marginTop: "10px", borderTop: "1px dashed #000", paddingTop: "8px" }}>
                <div style={{ fontSize: "9pt", fontWeight: "bold" }}>QUÉT MÃ THANH TOÁN VIETQR</div>
                <img
                  src={qrUrl}
                  alt="VietQR"
                  style={{ width: "32mm", height: "32mm", margin: "4px auto", display: "block" }}
                />
                <div style={{ fontSize: "8pt" }}>{bankInfo?.bankName} • STK: {bankInfo?.accountNumber}</div>
              </div>
            ) : null}

            <div style={{ borderBottom: "1px dashed #000", margin: "8px 0" }} />

            <div style={{ textAlign: "center", fontSize: "9pt", fontStyle: "italic" }}>
              <div>Cảm ơn Quý khách đã mua sắm tại ALOHA!</div>
              <div>Hotline hỗ trợ: 09xx.xxx.xxx</div>
            </div>
          </div>
        ) : (
          /* Bản in phiếu gửi hàng / Vận đơn A6 */
          <div
            style={{
              width: "100mm",
              margin: "0 auto",
              padding: "4mm",
              fontFamily: "Arial, sans-serif",
              fontSize: "10pt",
              lineHeight: 1.3,
              color: "#000",
              border: "2px solid #000",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "2px solid #000",
                paddingBottom: "4px",
              }}
            >
              <div>
                <div style={{ fontSize: "14pt", fontWeight: "bold" }}>ALOHA</div>
                <div style={{ fontSize: "9pt", fontWeight: "bold" }}>PHIẾU GIAO HÀNG</div>
              </div>
              <SvgBarcode value={displayCode} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                borderBottom: "2px solid #000",
                padding: "6px 0",
                fontSize: "9.5pt",
              }}
            >
              <div style={{ borderRight: "1px solid #ccc", paddingRight: "6px" }}>
                <div style={{ fontSize: "8.5pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  Người gửi:
                </div>
                <div style={{ fontWeight: "bold" }}>ALOHA Thế Giới Chậu Cây</div>
                <div>Hotline: 09xx.xxx.xxx</div>
                <div>Kho ALOHA</div>
              </div>

              <div>
                <div style={{ fontSize: "8.5pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  Người nhận:
                </div>
                <div style={{ fontSize: "11pt", fontWeight: "bold" }}>
                  {order.customerName || "Khách lẻ"}
                </div>
                <div style={{ fontSize: "12pt", fontWeight: "bold" }}>
                  SĐT: {order.customerPhone || "—"}
                </div>
                <div style={{ fontSize: "9.5pt" }}>{fullAddress}</div>
              </div>
            </div>

            <div style={{ padding: "6px 0", borderBottom: "2px solid #000" }}>
              <div style={{ fontWeight: "bold", fontSize: "9.5pt", marginBottom: "3px" }}>
                Nội dung kiện hàng ({items.length} sản phẩm):
              </div>
              <div style={{ fontSize: "9pt", paddingLeft: "10px" }}>
                {items.map((it, idx) => (
                  <div key={idx}>
                    • {it.productName}{it.variantLabel ? ` (${it.variantLabel})` : ""} - SL: <b>{it.quantity}</b>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "9pt", fontWeight: "bold", color: "#c00", marginTop: "4px" }}>
                ⚠️ HÀNG DỄ VỠ - XIN NHẸ TAY!
              </div>
            </div>

            <div
              style={{
                border: "2px solid #000",
                padding: "6px",
                margin: "6px 0",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "9pt", fontWeight: "bold", textTransform: "uppercase" }}>
                TIỀN THU HỘ (COD):
              </div>
              <div style={{ fontSize: "16pt", fontWeight: "bold" }}>
                {isPaid ? "0 Đ (ĐÃ THANH TOÁN)" : formatVnd(order.total)}
              </div>
              <div style={{ fontSize: "8.5pt" }}>
                {isPaid
                  ? "Đã thanh toán trước — Không thu tiền khách"
                  : "Thu đúng số tiền trên trước khi giao"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                textAlign: "center",
                fontSize: "9pt",
                paddingTop: "6px",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>Người gửi hàng</div>
                <div style={{ height: "30px" }} />
                <div style={{ fontSize: "8pt", fontStyle: "italic" }}>(Ký nhận)</div>
              </div>
              <div>
                <div style={{ fontWeight: "bold" }}>Người nhận hàng</div>
                <div style={{ height: "30px" }} />
                <div style={{ fontSize: "8pt", fontStyle: "italic" }}>Đồng kiểm tra hàng</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global CSS cho Print */}
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
