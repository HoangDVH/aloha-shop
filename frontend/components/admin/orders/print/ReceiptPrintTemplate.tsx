import { formatVnd } from "@/lib/api";
import type { PrintableOrder, PrintItem } from "./printTypes";
import type { ShopBankInfo } from "@/lib/bankTransfer";

export function ReceiptPreview({
  order,
  displayCode,
  orderDate,
  fullAddress,
  items,
  subtotal,
  isPaid,
  qrUrl,
  bankInfo,
  paperSize,
}: {
  order: PrintableOrder;
  displayCode: string;
  orderDate: string;
  fullAddress: string;
  items: PrintItem[];
  subtotal: number;
  isPaid: boolean;
  qrUrl: string | null;
  bankInfo: ShopBankInfo | null;
  paperSize: "k80" | "k58" | "a4";
}) {
  return (
    <div className="space-y-3 font-mono leading-tight">
      <div className="text-center space-y-1">
        <p className="text-sm font-extrabold uppercase tracking-wide">ALOHA THẾ GIỚI CHẬU CÂY</p>
        <p className="text-[10px] text-gray-600">Chậu xi măng nhẹ, gốm sứ & cây phong thủy</p>
        <p className="text-[10px] text-gray-600">Hotline / Zalo: 09xx.xxx.xxx</p>
        <p className="text-[10px] text-gray-600">Website: alohathegioichaucay.com</p>
      </div>

      <div className="border-b border-dashed border-gray-400 my-2" />

      <div className="text-center space-y-0.5">
        <h2 className="text-sm font-black uppercase tracking-wider">HÓA ĐƠN BÁN HÀNG</h2>
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
              <span>{it.quantity} x {it.isGift ? "0đ" : formatVnd(it.price)}</span>
              <span className="font-semibold text-black">{it.isGift ? "0đ" : formatVnd(it.price * it.quantity)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-dashed border-gray-400 my-2" />

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
  );
}

export function ReceiptHiddenPrint({
  order,
  displayCode,
  orderDate,
  fullAddress,
  items,
  subtotal,
  isPaid,
  qrUrl,
  bankInfo,
  paperSize,
}: {
  order: PrintableOrder;
  displayCode: string;
  orderDate: string;
  fullAddress: string;
  items: PrintItem[];
  subtotal: number;
  isPaid: boolean;
  qrUrl: string | null;
  bankInfo: ShopBankInfo | null;
  paperSize: "k80" | "k58" | "a4";
}) {
  return (
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
  );
}
