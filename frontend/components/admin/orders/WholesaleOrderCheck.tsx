"use client";
import { useQuery } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
type Result = { canCheckout: boolean; policyVersion: string; issues: Array<{ message: string }>; history: string };
export function WholesaleOrderCheck({ code }: { code: string }) {
  const query = useQuery({ queryKey: ["admin", "order-policy", code], queryFn: () => siRequest<{ data: { wholesaleEligibilityNow: Result | null; wholesaleEligibility?: Result } }>(`/api/shop/admin/orders/${encodeURIComponent(code)}`) });
  const current = query.data?.data.wholesaleEligibilityNow;
  const saved = query.data?.data.wholesaleEligibility;
  return <div className="space-y-3 text-sm">
    {query.error && <p role="alert" className="text-red-700">{query.error.message}</p>}
    {!query.data && !query.error && <p>Đang kiểm tra…</p>}
    {current && <><p className="font-semibold">{current.canCheckout ? "Đủ điều kiện theo chính sách hiện tại" : "Cần bổ sung theo chính sách hiện tại"}</p>
      <ul className="list-disc space-y-1 pl-5">{current.issues.map((i, index) => <li key={index}>{i.message}</li>)}</ul>
      <p>Lịch sử: {current.history === "returning" ? "Đã mua hàng" : current.history === "new" ? "Chưa có đơn hoàn tất" : "Chưa xác minh được"}</p></>}
    {saved && <p className="text-slate-500">Lúc đặt: {saved.canCheckout ? "Đủ điều kiện" : "Cần bổ sung"}. Phiên bản chính sách: {saved.policyVersion}.</p>}
    <button onClick={() => void query.refetch()} className="rounded border px-3 py-2">Kiểm tra lại</button>
  </div>;
}
