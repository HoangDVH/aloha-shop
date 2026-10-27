"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Package, MapPin } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { displayShopOrderCode, type ShopOrder } from "@/lib/orders";
import { isOrderShippingPending } from "@/lib/orderShippingStatus";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { OrderGoodsSavings, OrderLineTags, OrderSavedTotal, orderListSubtotal } from "./OrderCampaignBits";
import { OrderShipFeeChangeNote } from "./OrderShipFeeChangeNote";
import { CopyOrderCode } from "./CopyOrderCode";
import type { heroFor } from "./orderHero";

export function OrderOverview({ order, hero, addressLine, payLabel, children, paymentAction = false }: {
  order: ShopOrder; hero: ReturnType<typeof heroFor>; addressLine: string; payLabel?: string;
  children?: ReactNode; paymentAction?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const details = order.orderDetails || [];
  const quantity = details.filter(d => !d.isGift).reduce((n, d) => n + d.quantity, 0);
  const gifts = details.filter(d => d.isGift).reduce((n, d) => n + d.quantity, 0);
  const pendingShip = isOrderShippingPending(order);
  const pickup = order.deliveryMethod === "nhan_cua_hang";
  const review = order.orderStatus === "cho_xac_nhan" && hero.tone !== "bad";
  const paid = order.paymentStatus === "paid";
  const syncing = order.kvPushStatus && order.kvPushStatus !== "synced";
  const Icon = hero.tone === "bad" ? hero.Icon : CheckCircle2;
  const row = (label: string, value: ReactNode) => <div className="flex justify-between gap-4"><span className="text-slate-600">{label}</span><span className="shrink-0 text-right font-medium tabular-nums">{value}</span></div>;
  return <article className="overflow-hidden rounded-2xl border border-[#E8E2D6] bg-white shadow-sm">
    <header className="border-b border-[#E8E2D6] bg-gradient-to-r from-green-50 to-white px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <Icon size={30} className={`mt-0.5 shrink-0 ${hero.tone === "bad" ? "text-red-600" : "text-[var(--aloha-green)]"}`} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold text-[var(--aloha-ink)] sm:text-xl">{hero.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{displayShopOrderCode(order)}</span>
            <CopyOrderCode code={displayShopOrderCode(order)} />
            {order.createdAt && <time dateTime={order.createdAt}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(order.createdAt))}</time>}
            <span>· {paid ? "Đã thanh toán" : order.method === "Pending" ? "Chưa yêu cầu thanh toán" : payLabel || (order.method === "Transfer" ? "Chuyển khoản" : "Thanh toán khi nhận hàng")}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {review
              ? "ALOHA sẽ kiểm tra sản phẩm và gửi hình ảnh thực tế cho bạn qua Zalo xác nhận trước. Sau khi bạn xác nhận hình ảnh thực tế, ALOHA gửi hướng dẫn thanh toán trước toàn bộ đơn hàng hoặc đặt cọc"
              : hero.subtitle}
          </p>
          {syncing && <p className="mt-1 text-xs text-amber-800" role="status">Đang chuyển đơn đến cửa hàng · Bạn không cần đặt lại.</p>}
        </div>
      </div>
      <div className="mt-4"><OrderStatusTimeline order={order} compact /></div>
    </header>

    <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
      <section className="order-2 min-w-0 border-t border-[#E8E2D6] px-4 py-4 lg:order-1 lg:border-t-0 lg:border-r lg:px-6" aria-label="Sản phẩm trong đơn">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><Package size={17} className="text-[var(--aloha-green)]" />Sản phẩm <span className="font-normal text-slate-500">({quantity}{gifts ? ` + ${gifts} quà` : ""})</span></h2>
        <ul className="divide-y divide-slate-100">
          {details.map((item, i) => <li key={`${item.productCode}-${i}`} className={`py-3 ${expanded || i === 0 ? "" : i < 3 ? "hidden lg:block" : "hidden"}`}>
            <div className="flex gap-3">
              {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-100" /> : <Package size={28} className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 p-3 text-green-700" />}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-slate-800">{item.productName}</p>
                {item.variantLabel && !item.productName.includes(item.variantLabel) && <p className="mt-0.5 text-xs text-slate-500">{item.variantLabel}</p>}
                <p className="mt-1 text-xs text-slate-500">{item.productCode} · ×{item.quantity}</p>
                <OrderLineTags d={item} />
                {item.note && <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer text-green-800">Ghi chú sản phẩm</summary><p className="mt-1 whitespace-pre-wrap break-words">{item.note}</p></details>}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{item.isGift ? "0đ" : formatVnd(item.price * item.quantity)}</span>
            </div>
          </li>)}
        </ul>
        {details.length > 1 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className={`min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-green-800 hover:bg-green-50 ${details.length <= 3 ? "lg:hidden" : ""}`}>{expanded ? "Thu gọn sản phẩm" : `Xem tất cả ${details.length} dòng sản phẩm`}</button>}
        {children && <section id="order-payment-actions" className="mt-3 scroll-mt-28 space-y-3" aria-label="Thao tác đơn hàng">{children}</section>}
      </section>

      <aside className="order-1 px-4 py-4 lg:order-2 lg:px-6">
        <h2 className="mb-3 text-sm font-bold">Chi tiết thanh toán</h2>
        <div className="space-y-2 text-sm">
          {row("Tiền hàng", formatVnd(orderListSubtotal(order) ?? order.subtotal ?? 0))}
          <OrderGoodsSavings order={order} />
          {row("Phí vận chuyển", pickup ? "0đ (Nhận tại cửa hàng)" : pendingShip ? <span className="text-amber-700">Chờ xác nhận</span> : formatVnd(order.shippingFeeOriginal ?? (order.shippingFee || 0) + (order.shippingDiscount || 0)))}
          {!pickup && !pendingShip && Boolean(order.shippingDiscount) && row(order.shippingPromotion?.title || "Hỗ trợ phí ship", <span className="text-green-800">−{formatVnd(order.shippingDiscount!)}</span>)}
          {!pickup && !pendingShip && Boolean(order.shippingDiscount) && row("Phí ship thực trả", formatVnd(order.shippingFee || 0))}
          <OrderShipFeeChangeNote order={order} />
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><span className="font-bold">{paid ? "Tổng thanh toán" : "Tổng tạm tính"}</span><strong className="text-xl tabular-nums text-[#EE6055]">{formatVnd(order.total)}</strong></div>
          <p className="text-xs text-slate-500">{pickup ? "Nhận tại cửa hàng" : pendingShip ? "Chưa gồm phí vận chuyển" : "Đã gồm phí vận chuyển"}</p>
          <OrderSavedTotal order={order} />
        </div>
        <section className="mt-4 border-t border-slate-100 pt-3" aria-label="Người nhận hàng">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin size={14} />{pickup ? "Người nhận tại cửa hàng" : "Người nhận hàng"}</h2>
          <p className="mt-1 text-sm font-semibold">{order.customerName} · {order.customerPhone}</p>
          <details className="mt-1 text-xs text-slate-600 lg:hidden"><summary className="cursor-pointer"><span className="inline align-top">{addressLine ? `${addressLine.length > 60 ? addressLine.slice(0, 60) + "…" : addressLine} · Xem đầy đủ` : "Thông tin nhận hàng"}</span></summary><p className="mt-2 break-words leading-relaxed">{addressLine || "Nhận tại cửa hàng Aloha"}</p></details>
          <p className="mt-1 hidden break-words text-xs leading-relaxed text-slate-600 lg:block">{addressLine || "Nhận tại cửa hàng Aloha"}</p>
        </section>
        {(order.customerNote || order.kvInvoiceCode || order.cancelReason || order.backorderStatus === "cancelled") && <details className="mt-3 text-xs text-slate-600"><summary className="min-h-8 cursor-pointer font-semibold text-green-800">Ghi chú và thông tin bổ sung</summary>
          {order.customerNote && <p className="mt-2 whitespace-pre-wrap break-words">Ghi chú: {order.customerNote}</p>}
          {order.kvInvoiceCode && <p className="mt-2">Hóa đơn: {order.kvInvoiceCode}</p>}
          {order.cancelReason && <p className="mt-2">Lý do hủy: {order.cancelReason}</p>}
        </details>}
      </aside>
    </div>
    <footer className="flex flex-wrap gap-2 border-t border-[#E8E2D6] px-4 py-3 sm:px-6">
      <Link href={paymentAction ? "#order-payment-actions" : "/tai-khoan?tab=don-mua"} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[var(--aloha-green)] px-4 text-sm font-bold text-white sm:flex-none">{paymentAction ? "Xem thông tin thanh toán" : "Theo dõi đơn"}</Link>
      <Link href="/tim" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-green-200 px-4 text-sm font-semibold text-green-800 sm:flex-none">Tiếp tục mua</Link>
      <a href="tel:0794901233" className="inline-flex min-h-11 w-full items-center justify-center text-xs text-slate-500 sm:ml-auto sm:w-auto">Cần hỗ trợ? 079 490 1233</a>
    </footer>
  </article>;
}
