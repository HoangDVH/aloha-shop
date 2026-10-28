import { useState, useMemo } from "react";
import { Button, Drawer, Dropdown, message } from "antd";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  MapPin,
  MoreHorizontal,
  Package,
  Printer,
  Trash2,
  User,
  Info,
} from "lucide-react";
import { resolveOrderAddress } from "../print/printTypes";
import { PAYMENT_BADGES, fmtTime, type OrderRow } from "./orderTypes";

export function WebOrdersMobileDetailDrawer({
  detailOrder,
  onClose,
  onPrintReceipt,
  onPrintShipping,
  onCheckWholesale,
  onVoidTest,
}: {
  detailOrder: OrderRow | null;
  onClose: () => void;
  onPrintReceipt: (order: OrderRow) => void;
  onPrintShipping: (order: OrderRow) => void;
  onCheckWholesale?: (code: string) => void;
  onVoidTest?: (order: OrderRow) => void;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [expandedItems, setExpandedItems] = useState(false);

  const copyToClipboard = (text: string, type: "code" | "phone") => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      message.success(`Đã sao chép: ${text}`);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedPhone(true);
      message.success(`Đã sao chép số điện thoại: ${text}`);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const detailAddress = useMemo(() => resolveOrderAddress(detailOrder), [detailOrder]);

  const detailItems = useMemo(() => {
    if (!detailOrder) return [];
    if (detailOrder.orderDetails && detailOrder.orderDetails.length > 0) {
      return detailOrder.orderDetails.map((it: any) => {
        const quantity = Number(it.quantity) || 1;
        const price = Number(it.price) || 0;
        const discount = Number(it.discount) || 0;
        const sellPrice = Math.max(0, price - discount);
        const isWholesale =
          it.priceKind === "si" ||
          detailOrder.priceMode === "si" ||
          (Number(it.giaSi) > 0 && price === Number(it.giaSi));

        return {
          productCode: it.productCode || it.ma || "SP",
          productName: it.productName || it.ten || "Sản phẩm",
          quantity,
          price,
          discount,
          sellPrice,
          lineTotal: sellPrice * quantity,
          variantLabel: it.variantLabel || "",
          imageUrl: it.imageUrl || it.anh || "",
          note: it.note || it.ghiChu || "",
          isWholesale,
          isGift: Boolean(it.isGift),
        };
      });
    }
    return [
      {
        productCode: detailOrder.code,
        productName: "Đơn hàng web tổng hợp",
        quantity: 1,
        price: detailOrder.total,
        discount: 0,
        sellPrice: detailOrder.total,
        lineTotal: detailOrder.total,
        variantLabel: "",
        imageUrl: "",
        note: "",
        isWholesale: detailOrder.priceMode === "si",
        isGift: false,
      },
    ];
  }, [detailOrder]);

  const detailTotalQuantity = useMemo(() => {
    return detailItems.reduce((sum, it) => sum + it.quantity, 0);
  }, [detailItems]);

  const detailSubtotal = useMemo(() => {
    if (!detailOrder) return 0;
    if (detailOrder.subtotal) return detailOrder.subtotal;
    return detailItems.reduce((sum, it) => sum + it.lineTotal, 0);
  }, [detailOrder, detailItems]);

  if (!detailOrder) return null;

  return (
    <Drawer
      open={Boolean(detailOrder)}
      onClose={onClose}
      placement="right"
      width="100%"
      destroyOnHidden
      styles={{
        body: { padding: 0, backgroundColor: "#F7F8FA" },
        header: { display: "none" },
      }}
    >
      <div className="min-h-screen flex flex-col bg-[#F7F8FA] pb-24 text-slate-800">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 text-slate-700 hover:text-slate-900 active:scale-95 transition"
              aria-label="Quay lại danh sách"
            >
              <ChevronLeft size={22} />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-slate-900 tracking-tight font-mono">
                  {detailOrder.kvOrderCode || detailOrder.code}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(detailOrder.kvOrderCode || detailOrder.code, "code")}
                  className="p-0.5 text-slate-400 hover:text-slate-700 transition"
                  title="Sao chép mã đơn"
                >
                  {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="text-[11px] text-slate-400">
                {fmtTime(detailOrder.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${
                PAYMENT_BADGES[detailOrder.paymentStatus]?.badgeCls || "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {PAYMENT_BADGES[detailOrder.paymentStatus]?.label || detailOrder.paymentStatus}
            </span>

            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: "receipt",
                    label: "In hoá đơn K80",
                    icon: <Printer size={14} className="text-[#2D5A27]" />,
                    onClick: () => onPrintReceipt(detailOrder),
                  },
                  {
                    key: "shipping",
                    label: "In phiếu gửi A6",
                    icon: <Package size={14} className="text-slate-600" />,
                    onClick: () => onPrintShipping(detailOrder),
                  },
                  ...(detailOrder.priceMode === "si" && onCheckWholesale
                    ? [
                        {
                          key: "si",
                          label: "Kiểm tra sỉ",
                          onClick: () => onCheckWholesale(detailOrder.code),
                        },
                      ]
                    : []),
                  { type: "divider" },
                  ...(onVoidTest
                    ? [
                        {
                          key: "void",
                          label: detailOrder.voidTestBlock ? "Không thể huỷ đơn" : "Huỷ đơn test KiotViet",
                          danger: !detailOrder.voidTestBlock,
                          disabled: Boolean(detailOrder.voidTestBlock),
                          icon: <Trash2 size={14} />,
                          onClick: () => {
                            if (!detailOrder.voidTestBlock) onVoidTest(detailOrder);
                          },
                        },
                      ]
                    : []),
                ],
              }}
            >
              <button type="button" className="p-1 text-slate-600 hover:text-slate-900">
                <MoreHorizontal size={20} />
              </button>
            </Dropdown>
          </div>
        </header>

        <div className="p-3.5 space-y-3">
          {/* Card thông tin khách hàng */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 truncate">
                  {detailOrder.customerName || "Khách lẻ"}
                </div>
                {detailOrder.customerPhone ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                    <a href={`tel:${detailOrder.customerPhone}`} className="hover:underline">
                      {detailOrder.customerPhone}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(detailOrder.customerPhone!, "phone")}
                      className="p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      {copiedPhone ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Không có số điện thoại</div>
                )}
              </div>
            </div>

            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </div>

          {/* Card danh sách sản phẩm */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            {(expandedItems ? detailItems : detailItems.slice(0, 3)).map((it, idx) => (
              <div key={idx} className="p-3.5 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={20} className="text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs uppercase text-slate-900 leading-snug">
                      {it.productName}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {it.variantLabel ? (
                        <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {it.variantLabel}
                        </span>
                      ) : null}
                      {it.isWholesale ? (
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Giá sỉ
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          Bảng giá Web
                        </span>
                      )}
                      <span className="inline-block text-[10px] font-semibold text-slate-400 font-mono">
                        {it.productCode}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1">
                      {it.sellPrice.toLocaleString("vi-VN")} x {it.quantity}
                    </div>
                  </div>

                  <div className="font-bold text-sm text-slate-900 tabular-nums shrink-0">
                    {it.lineTotal.toLocaleString("vi-VN")}
                  </div>
                </div>

                {it.note ? (
                  <div className="rounded-xl bg-slate-50/90 border border-slate-100 p-2.5 text-xs text-slate-700 flex items-start gap-2">
                    <Info size={14} className="shrink-0 text-slate-400 mt-0.5" />
                    <span className="leading-relaxed">{it.note}</span>
                  </div>
                ) : null}
              </div>
            ))}

            {detailItems.length > 3 ? (
              <button
                type="button"
                onClick={() => setExpandedItems(!expandedItems)}
                className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 bg-slate-50/50 hover:bg-slate-50 transition"
              >
                <span>{expandedItems ? "↑ Thu gọn" : `↓ Mở rộng (${detailItems.length} sản phẩm)`}</span>
              </button>
            ) : null}
          </div>

          {/* Card tổng hợp thanh toán */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="flex items-center gap-1">
                <span>Tổng tiền hàng</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10.5px] font-semibold text-slate-600">
                  {detailTotalQuantity}
                </span>
              </span>
              <span className="font-medium tabular-nums">{detailSubtotal.toLocaleString("vi-VN")}</span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>Giảm giá</span>
              <span className="tabular-nums">
                {(detailOrder.discountAmount || detailOrder.voucherDiscount || 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span className="uppercase">THU PHÍ SHIP</span>
              <span className="tabular-nums">{(detailOrder.shippingFee || 0).toLocaleString("vi-VN")}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="font-bold text-sm text-slate-900">Khách cần trả</span>
              <span className="font-bold text-sm text-slate-900 tabular-nums">
                {detailOrder.total.toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-sm text-slate-900">Khách đã trả</span>
              <span className="font-black text-sm text-[#2D5A27] tabular-nums">
                {(detailOrder.paymentStatus === "paid" ? detailOrder.total : 0).toLocaleString("vi-VN")}
              </span>
            </div>

            <div className="flex justify-end text-[11px] text-slate-400 pt-0.5">
              <span>✓ {detailOrder.paymentStatus === "cod" ? "Thu hộ COD" : "Chuyển khoản"}</span>
            </div>
          </div>

          {/* Card Ghi chú */}
          {detailOrder.notes || detailOrder.customerNote ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1 text-xs">
              <div className="text-[11px] font-semibold text-slate-400">Ghi chú</div>
              <div className="font-bold text-slate-900 uppercase leading-relaxed">
                {detailOrder.notes || detailOrder.customerNote}
              </div>
            </div>
          ) : null}

          {/* Card thông tin chi nhánh & kênh bán */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
            <div>
              <div className="text-[11px] text-slate-400">Bảng giá</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {detailOrder.priceMode === "si" ? "Bảng giá sỉ" : "Bảng giá Web"}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Kênh bán</div>
              <div className="font-bold text-slate-900 mt-0.5">Website ALOHA</div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Người bán</div>
              <div className="font-bold text-slate-900 mt-0.5">ALOHA Shop</div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Người tạo</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {detailOrder.customerName ? "Khách đặt web" : "Hệ thống"}
              </div>
            </div>

            <div className="col-span-2 pt-1 border-t border-slate-100">
              <div className="text-[11px] text-slate-400">Chi nhánh</div>
              <div className="font-bold text-slate-900 mt-0.5">Kho chính Aloha</div>
            </div>
          </div>

          {/* Địa chỉ giao hàng */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs text-xs space-y-1">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <MapPin size={12} className="text-[#2D5A27]" />
              <span>Địa chỉ giao hàng</span>
            </div>
            <div className="font-semibold text-slate-800 leading-relaxed">
              {detailAddress || "Nhận tại cửa hàng"}
            </div>
          </div>

          {/* Các nút hành động in ấn */}
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="primary"
                className="!bg-[#2D5A27] font-semibold h-10"
                icon={<Printer size={14} />}
                onClick={() => onPrintReceipt(detailOrder)}
              >
                Hoá đơn K80
              </Button>
              <Button
                className="font-semibold h-10"
                icon={<Package size={14} />}
                onClick={() => onPrintShipping(detailOrder)}
              >
                Phiếu gửi A6
              </Button>
            </div>

            {detailOrder.priceMode === "si" && onCheckWholesale ? (
              <Button
                block
                className="font-semibold"
                onClick={() => onCheckWholesale(detailOrder.code)}
              >
                Kiểm tra điều kiện sỉ
              </Button>
            ) : null}

            {!detailOrder.voidTestBlock && onVoidTest ? (
              <Button
                danger
                block
                icon={<Trash2 size={14} />}
                onClick={() => onVoidTest(detailOrder)}
              >
                Huỷ đơn test KiotViet
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
