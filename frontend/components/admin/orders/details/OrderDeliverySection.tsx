import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Lightbulb,
  ShoppingBag,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { OrderDetailsExpandedProps } from "../OrderDetailsExpanded";

export function OrderDeliverySection({
  order,
  fullAddress,
  streetDetail,
  districtProvince,
  wardName,
  isPickup,
}: {
  order: OrderDetailsExpandedProps["order"];
  fullAddress: string;
  streetDetail: string;
  districtProvince: string;
  wardName: string;
  isPickup: boolean;
}) {
  const [deliveryOpen, setDeliveryOpen] = useState(true);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
      {/* Header thông tin giao hàng rút gọn */}
      <div
        onClick={() => setDeliveryOpen(!deliveryOpen)}
        className="p-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900 text-[13px]">
            <ShoppingBag size={15} className="text-[#2D5A27] shrink-0" />
            <span>
              {isPickup ? (
                <>
                  Hình thức: <b className="text-slate-900 font-bold">Nhận tại cửa hàng</b>
                </>
              ) : (
                <>
                  Tự giao đến: <b className="text-slate-900 font-bold">{fullAddress || "Chưa có địa chỉ"}</b>
                </>
              )}
              {" "} - SĐT:{" "}
              <b className="text-[#2D5A27] font-bold">{order.customerPhone || "—"}</b>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 text-[13px]">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span>
              Địa chỉ lấy hàng: <b className="text-slate-900 font-bold">90/2 Nguyễn Phúc Chu, Phường Tân Bình, Thành phố Hồ Chí Minh - +84 794 901 233</b>
            </span>
          </div>
        </div>

        <button type="button" className="text-slate-500 p-1">
          {deliveryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {deliveryOpen ? (
        <div className="p-4 space-y-4">
          {/* Lưới 2 cột thông tin người nhận và kiện hàng */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cột trái */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Người nhận:</span>
                <input
                  type="text"
                  readOnly
                  value={order.customerName || "Khách lẻ"}
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Điện thoại:</span>
                <input
                  type="text"
                  readOnly
                  value={order.customerPhone || ""}
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-[#2D5A27] font-bold text-[13px] font-mono outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Địa chỉ:</span>
                <input
                  type="text"
                  readOnly
                  value={isPickup ? "Nhận tại cửa hàng" : streetDetail || fullAddress || "Chưa có địa chỉ"}
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] outline-none truncate"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Khu vực:</span>
                <input
                  type="text"
                  readOnly
                  value={districtProvince}
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] outline-none truncate"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Phường/Xã:</span>
                <input
                  type="text"
                  readOnly
                  value={wardName}
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] outline-none"
                />
              </div>
            </div>

            {/* Cột phải */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Mã vận đơn:</span>
                <input
                  type="text"
                  readOnly
                  placeholder="Chưa có mã vận đơn"
                  value={order.kvOrderCode ? `VD-${order.kvOrderCode}` : ""}
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Trọng lượng:</span>
                <div className="flex-1 h-9 flex items-center border border-slate-300 rounded px-3 bg-white text-[13px]">
                  <span className="flex-1 text-slate-900 font-semibold">
                    {order.totalWeightGram || 500}
                  </span>
                  <span className="text-slate-500 font-semibold">g ▾</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Kích thước:</span>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    readOnly
                    value="10"
                    className="h-9 border border-slate-300 rounded px-2 bg-white text-center text-slate-900 font-semibold text-[13px]"
                  />
                  <input
                    type="text"
                    readOnly
                    value="10"
                    className="h-9 border border-slate-300 rounded px-2 bg-white text-center text-slate-900 font-semibold text-[13px]"
                  />
                  <input
                    type="text"
                    readOnly
                    value="10"
                    className="h-9 border border-slate-300 rounded px-2 bg-white text-center text-slate-900 font-semibold text-[13px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Khai giá:</span>
                <div className="flex items-center gap-2 h-9">
                  <input type="checkbox" readOnly className="w-4 h-4 rounded border-slate-400 text-[#2D5A27]" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-slate-800 font-semibold text-[13px] shrink-0">Dịch vụ:</span>
                <input
                  type="text"
                  readOnly
                  value="2H (Giao nhanh)"
                  className="flex-1 h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Banner cảnh báo địa chỉ 2 cấp KiotViet */}
          {order.kvDeliveryAddress?.state === "needs_review" ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 flex items-center justify-between text-sky-950 text-xs">
              <div className="flex items-start gap-2.5">
                <Lightbulb size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    Địa chỉ trên đã thay đổi sau khi sáp nhập ngày 01/07/2025.
                  </span>
                  <span className="text-sky-900 ml-1 font-medium">
                    Bạn có muốn đổi thành địa chỉ mới: <b>{order.kvDeliveryAddress.reason}</b>?
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 bg-white border border-blue-500 text-blue-700 rounded text-xs font-bold hover:bg-blue-50 transition shrink-0"
              >
                Đổi địa chỉ
              </button>
            </div>
          ) : order.kvDeliveryAddress?.current ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-950 font-medium flex items-center gap-2">
              <Lightbulb size={15} className="text-blue-600 shrink-0" />
              <span>
                Đã đồng bộ địa chỉ 2 cấp KiotViet:{" "}
                <b className="font-bold">
                  {order.kvDeliveryAddress.current.ward}, {order.kvDeliveryAddress.current.province}
                </b>
              </span>
            </div>
          ) : null}

          {/* Các trường vận chuyển xếp dọc */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            {/* Hàng 1: Người giao */}
            <div className="flex items-center gap-4">
              <span className="w-36 text-slate-800 font-semibold text-[13px] shrink-0">Người giao:</span>
              <div className="w-96 max-w-full h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] flex items-center justify-between shadow-2xs">
                <span>AhaMove</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">✔ KiotViet</span>
                  <ChevronDown size={14} className="text-slate-500" />
                </div>
              </div>
            </div>

            {/* Hàng 2: Thu hộ tiền */}
            <div className="flex items-center gap-4">
              <span className="w-36 text-slate-800 font-semibold text-[13px] shrink-0">Thu hộ tiền:</span>
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  checked={order.usingCod || order.paymentStatus === "cod"}
                  readOnly
                  className="w-4 h-4 text-[#2D5A27] rounded border-slate-400 cursor-pointer"
                />
                <span className="text-[13px] font-semibold text-slate-900">
                  {order.usingCod || order.paymentStatus === "cod" ? "Có thu hộ COD" : "Đã thanh toán trước"}
                </span>
              </div>
            </div>

            {/* Hàng 3: Phí trả ĐTGH */}
            <div className="flex items-center gap-4">
              <span className="w-36 text-slate-800 font-semibold text-[13px] shrink-0 flex items-center gap-1">
                <span>Phí trả ĐTGH</span>
                <Info size={13} className="text-slate-500" />
                <span>:</span>
              </span>
              <input
                type="text"
                readOnly
                value={order.shippingFee ? formatVnd(order.shippingFee) : "0 ₫"}
                className="w-96 max-w-full h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] tabular-nums outline-none"
              />
            </div>

            {/* Hàng 4: Thời gian giao hàng */}
            <div className="flex items-center gap-4">
              <span className="w-36 text-slate-800 font-semibold text-[13px] shrink-0">Thời gian giao hàng:</span>
              <div className="w-96 max-w-full h-9 border border-slate-300 rounded px-3 bg-white text-slate-900 font-semibold text-[13px] flex items-center justify-between shadow-2xs">
                <span>{new Date(order.createdAt).toLocaleDateString("vi-VN")}</span>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar size={14} />
                  <Clock size={14} />
                </div>
              </div>
            </div>

            {/* Hàng 5: Ghi chú giao hàng */}
            <div className="pt-1">
              <textarea
                rows={2}
                readOnly
                placeholder="Ghi chú giao..."
                value={order.notes || order.customerNote || ""}
                className="w-full border border-slate-300 rounded-md p-3 bg-white text-slate-900 font-medium text-[13px] placeholder-slate-400 outline-none resize-none"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
