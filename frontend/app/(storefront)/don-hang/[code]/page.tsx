"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import {
  getMyOrder,
  renewPaymentOrder,
  subscribeShopOrdersStream,
  type ShopOrder,
} from "@/lib/orders";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { heroFor, waitingStaff } from "@/components/order-status/orderHero";
import { OrderThanksModal } from "@/components/order-status/OrderThanksModal";
import { OrderSuccessView } from "@/components/order-status/OrderSuccessView";
import { OrderPendingView } from "@/components/order-status/OrderPendingView";

export default function DonHangStatusPage() {
  const params = useParams();
  const code = decodeURIComponent(String(params?.code || "").trim());
  const router = useRouter();
  const { user, loading: authLoading } = useShopAuth();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [renewMsg, setRenewMsg] = useState("");

  const reload = useCallback(
    async (silent = false) => {
      if (!code) return;
      if (!silent) setLoading(true);
      try {
        const data = await getMyOrder(code);
        setOrder((prev) => {
          if (prev && prev.paymentStatus !== "paid" && data.paymentStatus === "paid") {
            queueMicrotask(() => {
              setJustConfirmed(true);
              setShowThanks(true);
            });
          }
          return data;
        });
        setError("");
      } catch (e: any) {
        if (!silent) setError(e?.message || "Không tải được đơn");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [code]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/dang-nhap?next=${encodeURIComponent(`/don-hang/${code}`)}`);
      return;
    }
    void reload();
  }, [authLoading, user, code, router, reload]);

  // Khi hiện form cảm ơn: tải lại đơn để chắc có mã HĐ KV (HD…)
  useEffect(() => {
    if (!showThanks) return;
    void reload(true);
  }, [showThanks, reload]);

  const live =
    order &&
    (order.paymentStatus === "unpaid" ||
      order.paymentStatus === "processing" ||
      order.paymentStatus === "cod");

  useEffect(() => {
    if (!live) return;
    let sseOk = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const clearPoll = () => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    };
    const startPoll = () => {
      if (poll) return;
      poll = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible")
          return;
        if (sseOk) return;
        void reload(true);
      }, 15_000);
    };
    const unsub = subscribeShopOrdersStream(
      () => {
        void reload(true);
      },
      {
        onStatus: (ok) => {
          sseOk = ok;
          if (ok) clearPoll();
          else startPoll();
        },
      }
    );
    const boot = window.setTimeout(() => {
      if (!sseOk) startPoll();
    }, 5000);
    const onVis = () => {
      if (document.visibilityState === "visible" && !sseOk) {
        void reload(true);
        startPoll();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      unsub();
      clearPoll();
      window.clearTimeout(boot);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [live, reload]);

  if (authLoading || !user || loading) {
    return <ShopPageLoader fullscreen={false} />;
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertCircle className="mx-auto text-[#EE6055]" size={40} />
        <h1 className="mt-4 text-xl font-extrabold text-[var(--aloha-ink)]">Không tìm thấy đơn</h1>
        <p className="mt-2 text-sm text-slate-500">
          {error || "Đơn không tồn tại hoặc không thuộc tài khoản này."}
        </p>
        <Link
          href="/tai-khoan?tab=don-mua"
          className="mt-6 inline-flex rounded-xl bg-[var(--aloha-green)] px-5 py-2.5 text-sm font-bold text-white"
        >
          Xem đơn mua
        </Link>
      </div>
    );
  }

  const hero = heroFor(order);
  const isPaid = order.paymentStatus === "paid";
  const isCod = order.paymentStatus === "cod";
  const isSuccessView = isPaid || isCod;
  const isExpiredCk = order.paymentStatus === "expired" && order.method !== "Cash";
  const isUnpaidCk = order.paymentStatus === "unpaid" && order.method === "Transfer";
  const qrExpired =
    isUnpaidCk &&
    Boolean(order.expiresAt) &&
    new Date(String(order.expiresAt)).getTime() <= Date.now();
  const isWaitingStaff = isUnpaidCk && waitingStaff(order);
  const addressLine =
    order.deliveryMethod === "nhan_cua_hang"
      ? "Nhận tại cửa hàng ALOHA"
      : [order.shippingAddress, order.ward, order.province].filter(Boolean).join(", ");
  const payLabel =
    order.method === "Pending" || order.orderStatus === "cho_xac_nhan"
      ? "Thanh toán sau khi xác nhận ảnh (trả trước hoặc cọc tối thiểu phí ship)"
      : order.method === "Transfer" || order.method === "Card"
        ? "Chuyển khoản"
        : "Thanh toán khi nhận hàng (COD)";
  const itemCount = (order.orderDetails || []).reduce(
    (n, d) => n + (Number(d.quantity) || 0),
    0
  );

  const doRenewPayment = async () => {
    setBusy(true);
    setRenewMsg("");
    setCancelMsg("");
    try {
      const res = await renewPaymentOrder(order.code);
      setOrder(res.data);
    } catch (e: any) {
      setRenewMsg(e?.message || "Không tạo được mã mới");
    } finally {
      setBusy(false);
    }
  };

  if (showThanks && isPaid) {
    return <OrderThanksModal order={order} onClose={() => setShowThanks(false)} />;
  }

  return (
    <div className="relative mx-auto max-w-5xl animate-fade-up px-3 py-4 sm:px-4 lg:py-6">
      {isSuccessView ? (
        <OrderSuccessView
          order={order}
          hero={hero}
          isPaid={isPaid}
          addressLine={addressLine}
          payLabel={payLabel}
          itemCount={itemCount}
          justConfirmed={justConfirmed}
          reload={reload}
        />
      ) : (
        <OrderPendingView
          order={order}
          hero={hero}
          isUnpaidCk={isUnpaidCk}
          isWaitingStaff={isWaitingStaff}
          isExpiredCk={isExpiredCk}
          isCod={isCod}
          qrExpired={qrExpired}
          addressLine={addressLine}
          busy={busy}
          setBusy={setBusy}
          renewMsg={renewMsg}
          cancelMsg={cancelMsg}
          setCancelMsg={setCancelMsg}
          reportMsg={reportMsg}
          setReportMsg={setReportMsg}
          reload={reload}
          setOrder={setOrder}
          doRenewPayment={doRenewPayment}
        />
      )}
    </div>
  );
}
