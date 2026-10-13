"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { websiteApi } from "../api";
const labels: Record<string, string> = { finished: "Cây thành phẩm", pot: "Chậu / tiểu cảnh", raw: "Cây thô", other: "Nhóm khác (không hạn SL)" };
export function PurchaseGroupSelect({ ma }: { ma: string }) {
  const [open, setOpen] = useState(false);
  const path = `/api/shop/admin/wholesale-policy/products/${encodeURIComponent(ma)}`;
  const query = useQuery({ queryKey: ["admin", "purchase-group", ma], queryFn: () => websiteApi<{ group: string | null; configured: string | null }>(path), enabled: open });
  const mutation = useMutation({ mutationFn: (group: string) => websiteApi(path, { method: "PATCH", body: JSON.stringify({ group: group || null }) }), onSuccess: () => { void query.refetch(); } });
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-xs">Nhóm mua sỉ</summary>
    {query.data && <><p className="my-1 text-xs">Đang áp dụng: {labels[query.data.group || ""] || "Cần phân loại"}</p>
      <select aria-label={`Nhóm mua sỉ ${ma}`} value={query.data.configured || ""} disabled={mutation.isPending} onChange={e => mutation.mutate(e.target.value)} className="max-w-48 rounded border p-1 text-xs">
        <option value="">Theo nhóm catalog</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></>}
    {(query.error || mutation.error) && <p role="alert" className="text-xs text-red-700">{(query.error || mutation.error)?.message}</p>}
  </details>;
}
