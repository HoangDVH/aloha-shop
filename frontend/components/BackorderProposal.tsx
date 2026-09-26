"use client";

/** Yêu cầu đặt trước / chờ xử lý — Aloha liên hệ Zalo; không còn xác nhận báo giá trên web. */
export function BackorderProposal({ order }: { order: any; onAccepted?: () => void }) {
  if (!order.backorderStatus) return null;
  if (order.backorderStatus === "cancelled") {
    return (
      <p className="my-5 rounded-2xl bg-slate-50 p-5 text-sm">
        Yêu cầu đã hủy. {order.cancelReason}
      </p>
    );
  }
  if (order.backorderStatus === "ready") return null;

  return (
    <section className="my-5 space-y-3 rounded-2xl border border-green-200 bg-[var(--aloha-green-light)] p-5 text-sm">
      <h2 className="text-lg font-bold">
        {order.hasPreOrder
          ? "Yêu cầu đặt trước của bạn"
          : "Yêu cầu đặt hàng đang chờ xử lý"}
      </h2>
      <p>
        Aloha đã nhận yêu cầu và sẽ liên hệ bạn qua Zalo để xác nhận hàng, phí giao
        và thanh toán. Bạn chưa cần thanh toán trên website lúc này.
      </p>
    </section>
  );
}
