"use client";
import Link from "next/link";
import { useShopMeQuery } from "@/lib/authQueries";
import { useCart } from "@/lib/cart";
import { formatVnd } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
type CartQuote = { subtotal: number; minimum: number; remaining: number; missing: string[]; canCheckout: boolean };
export function useCartQuote() {
  const { data: user } = useShopMeQuery();
  const lines = useCart(s => s.lines).filter(l => l.selected);
  const isSi = user?.siStatus === "active" && user.roles.includes("si");
  const items = lines.map(l => ({ productCode: l.ma, quantity: l.qty }));
  const quote = useQuery({ queryKey: ["shop", "cart", "quote", user?.id, user?.siStatus, user?.siRegion, items],
    queryFn: () => siRequest<CartQuote>("/api/shop/cart/quote", { items }), enabled: Boolean(isSi && items.length), refetchInterval: 15000 });
  return { isSi, items, quote };
}
export function SiCartNotice() {
  const { isSi, items, quote } = useCartQuote();
  if (!isSi || !items.length) return null;
  if (quote.error) return <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{quote.error.message} <button className="underline" onClick={() => void quote.refetch()}>Kiểm tra lại</button></p>;
  if (!quote.data) return <p className="mb-5 text-sm" role="status">Đang kiểm tra điều kiện mua sỉ…</p>;
  const missing = quote.data.missing;
  const total = quote.data.subtotal;
  const minimum = quote.data.minimum;
  return <aside className="mb-5 rounded-2xl border border-green-200 bg-[var(--aloha-green-light)] p-4 text-sm">
    <p className="font-bold text-[var(--aloha-green-dark)]">Đơn hàng giá sỉ</p>
    {missing.length ? <p className="mt-2 text-amber-900">Cần báo giá trước khi đặt: {missing.join(", ")}</p> : minimum > 0 ? <>
      <p className="mt-2">{total>=minimum?"Đã đủ điều kiện mua sỉ":`Thêm ${formatVnd(minimum-total)} tiền hàng để đủ điều kiện mua sỉ`}</p>
      <progress max={minimum} value={Math.min(total,minimum)} className="mt-3 h-2 w-full accent-[var(--aloha-green)]" aria-label="Tiến độ đạt mức mua sỉ"/>
      {total<minimum&&<Link href="/tim" className="mt-2 inline-block font-semibold underline">Mua thêm sản phẩm</Link>}
    </> : <p className="mt-2">Giá sỉ áp dụng theo tài khoản đã được Aloha duyệt.</p>}
  </aside>;
}
