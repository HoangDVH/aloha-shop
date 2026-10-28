import { MapPin, Phone } from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { PrintableOrder, PrintItem } from "./printTypes";
import { SvgBarcode } from "./SvgBarcode";

export function ShippingPreview({
  order,
  displayCode,
  fullAddress,
  items,
  isPaid,
}: {
  order: PrintableOrder;
  displayCode: string;
  fullAddress: string;
  items: PrintItem[];
  isPaid: boolean;
}) {
  return (
    <div className="space-y-3 font-sans leading-normal">
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <div>
          <h2 className="text-base font-black tracking-wider text-black">ALOHA</h2>
          <p className="text-[10px] text-gray-600 font-semibold">PHIẾU GIAO HÀNG</p>
        </div>
        <SvgBarcode value={displayCode} />
      </div>

      <div className="grid grid-cols-2 gap-3 border-b-2 border-black pb-2 text-[11px]">
        <div className="border-r border-gray-300 pr-2 space-y-0.5">
          <p className="font-bold text-black uppercase text-[10px]">Từ (Người gửi):</p>
          <p className="font-semibold text-gray-900">ALOHA Thế Giới Chậu Cây</p>
          <p className="text-gray-600">Hotline: 09xx.xxx.xxx</p>
          <p className="text-gray-600 text-[10px]">Kho hàng ALOHA</p>
        </div>
        <div className="space-y-0.5">
          <p className="font-bold text-black uppercase text-[10px]">Đến (Người nhận):</p>
          <p className="text-sm font-black text-black uppercase">{order.customerName || "Khách lẻ"}</p>
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

      <div className="border-b border-black pb-2 space-y-1">
        <p className="font-bold text-[11px]">Nội dung hàng hóa ({items.length} món):</p>
        <ul className="text-[10.5px] text-gray-700 list-disc list-inside space-y-0.5">
          {items.map((it, idx) => (
            <li key={idx} className="truncate">
              {it.productName}{it.variantLabel ? ` (${it.variantLabel})` : ""} x <b>{it.quantity}</b>
            </li>
          ))}
        </ul>
        <p className="text-[10px] font-bold text-red-600 italic pt-0.5">
          ⚠️ HÀNG DỄ VỠ (CÂY CẢNH & CHẬU) - XIN NHẸ TAY!
        </p>
      </div>

      <div className="rounded-lg border-2 border-black p-2.5 text-center bg-gray-50">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">TIỀN THU HỘ (COD)</p>
        <p className="text-xl font-black text-black">
          {isPaid ? "0 VNĐ (ĐÃ THANH TOÁN)" : `${formatVnd(order.total)}`}
        </p>
        <p className="text-[10px] text-gray-600 font-medium mt-0.5">
          {isPaid
            ? "Đơn đã thanh toán trước — Tuyệt đối không thu thêm tiền của khách"
            : "Shipper thu đúng số tiền trên trước khi giao hàng"}
        </p>
      </div>

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
  );
}

export function ShippingHiddenPrint({
  order,
  displayCode,
  fullAddress,
  items,
  isPaid,
}: {
  order: PrintableOrder;
  displayCode: string;
  fullAddress: string;
  items: PrintItem[];
  isPaid: boolean;
}) {
  return (
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
  );
}
