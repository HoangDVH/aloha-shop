"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
const reasons: Record<string, string> = { api_unavailable: "API KiotViet chưa phản hồi", invoice_unavailable: "Chưa lấy được hóa đơn", invoice_mismatch: "Hóa đơn hoặc khách hàng không khớp", invoice_not_completed: "Hóa đơn chưa hoàn thành hoặc đã hủy/hoàn", invalid_received_amount: "Số tiền API chưa hợp lệ", insufficient_received_amount: "Chưa thu đủ tiền", order_changed_or_processing_failed: "Đơn đã thay đổi hoặc cần kiểm tra xử lý thanh toán" };
export function PaymentVerificationNotice({ code, reason, attempts }: { code: string; reason: string; attempts: number }) {
  const qc = useQueryClient();
  const retry = useMutation({ mutationFn: () => siRequest<{ message: string }>(`/api/shop/admin/orders/${encodeURIComponent(code)}/reconcile-payment`, {}),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "web-orders"] }); } });
  return <div className="text-xs text-amber-800">
    <p className="font-semibold">Chờ xác minh thanh toán{attempts >= 5 ? " — cần kiểm tra" : ""}</p>
    <p>{reasons[reason] || "Đang chờ đối soát"}</p>
    <button disabled={retry.isPending} onClick={() => retry.mutate()} className="mt-1 underline">{retry.isPending ? "Đang đối soát…" : "Đối soát lại"}</button>
    {retry.data && <p>{retry.data.message}</p>}{retry.error && <p role="alert">{retry.error.message}</p>}
  </div>;
}
