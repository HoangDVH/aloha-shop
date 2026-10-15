"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { siRequest } from "@/lib/siQueries";
import type { WholesalePolicy } from "@/lib/wholesalePolicy";

const fields = { hcmFirstMinimum: "Đơn đầu HCM (đ)", tinhMinimum: "Mỗi đơn tỉnh (đ)", finishedQuantity: "Cây thành phẩm / mẫu",
  cheapPotPrice: "Ngưỡng giá chậu, tiểu cảnh (đ)", cheapPotQuantity: "Chậu dưới ngưỡng / mẫu", rawQuantity: "Cây thô / mẫu" };
function PolicyForm({ policy }: { policy: WholesalePolicy }) {
  const [rules, setRules] = useState(policy);
  const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => siRequest<WholesalePolicy>("/api/shop/admin/wholesale-policy", { version: policy.version, rules }, "PATCH"),
    onSuccess: data => { qc.setQueryData(["admin", "purchase-policy"], data); void qc.invalidateQueries({ queryKey: ["shop", "wholesale-policy"] }); void qc.invalidateQueries({ queryKey: ["shop", "cart", "quote"] }); } });
  return <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-3">{Object.entries(fields).map(([key, label]) => <label key={key} className="text-sm">{label}
      <input required type="number" min={1} step={1} value={rules[key as keyof typeof fields]} onChange={e => setRules({ ...rules, [key]: Number(e.target.value) })} className="mt-1 w-full rounded border p-2" />
    </label>)}</div>
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-200/80">
      <Info size={14} className="text-slate-400 shrink-0" />
      <span>Mỗi mã hàng là một mẫu. Khách HCM đã có đơn hoàn tất/hóa đơn KiotViet được miễn mức đơn đầu. Khách tự bố trí xe nhận hàng tại cửa hàng hoặc TP.HCM.</span>
    </div>
    <button disabled={mutation.isPending} className="rounded bg-green-700 px-4 py-2 text-white">{mutation.isPending ? "Đang lưu…" : "Lưu chính sách"}</button>
    {mutation.error && <p role="alert" className="text-red-700">{mutation.error.message}</p>}
  </form>;
}
export function PurchasePolicyPanel() {
  const query = useQuery({ queryKey: ["admin", "purchase-policy"], queryFn: () => siRequest<WholesalePolicy>("/api/shop/admin/wholesale-policy") });
  return <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-bold">Chính sách mua sỉ dùng chung cho shop và admin</summary>
    <div className="mt-4">{query.data ? <PolicyForm key={query.data.version} policy={query.data} /> : <p>{query.error?.message || "Đang tải…"}</p>}</div>
  </details>;
}
