"use client";
import Link from "next/link";
import { useShopMeQuery } from "@/lib/authQueries";
import { useCart } from "@/lib/cart";
import { formatVnd } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
type CartQuote = { subtotal: number; minimum: number; remaining: number; missing: string[]; canCheckout: boolean; issues: Array<{ code: string; message: string }> };
export function useCartQuote(delivery?: { deliveryMethod: "giao_tan_noi" | "nhan_cua_hang"; province: string }) {
  const { data: user } = useShopMeQuery();
  const lines = useCart(s => s.lines).filter(l => l.selected);
  const isSi = user?.siStatus === "active" && user.roles.includes("si");
  const items = lines.map(l => ({ productCode: l.ma, quantity: l.qty }));
  const quote = useQuery({ queryKey: ["shop", "cart", "quote", user?.id, user?.siStatus, user?.siRegion, items, delivery],
    queryFn: () => siRequest<CartQuote>("/api/shop/cart/quote", { items, ...delivery }), enabled: Boolean(isSi && items.length), refetchInterval: 15000 });
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
  return <aside className="w-full bg-[var(--aloha-green-light)] px-4 py-3 sm:p-4 border-y border-green-200/80 sm:border sm:rounded-2xl text-sm mb-0 sm:mb-5">
    <p className="font-bold text-[var(--aloha-green-dark)]">Đơn hàng giá sỉ</p>
    {missing.length ? <p className="mt-2 text-amber-900">Cần báo giá trước khi đặt: {missing.join(", ")}</p> : minimum > 0 ? <>
      <p className="mt-2">{total>=minimum ? "Đã đủ mức tiền hàng tối thiểu" : `Thêm ${formatVnd(minimum-total)} tiền hàng để đủ điều kiện mua sỉ`}</p>
      <progress max={minimum} value={Math.min(total,minimum)} className="mt-3 h-2 w-full accent-[var(--aloha-green)]" aria-label="Tiến độ đạt mức mua sỉ"/>
      {total<minimum&&<Link href="/tim" className="mt-2 inline-block font-semibold underline">Mua thêm sản phẩm</Link>}
    </> : <p className="mt-2">Giá sỉ áp dụng theo tài khoản đã được Aloha duyệt.</p>}
    {quote.data.issues?.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-900">{quote.data.issues.filter(i => i.code !== "minimum" && i.code !== "price").map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>}
    {quote.data.canCheckout && <p className="mt-2 font-semibold">Giỏ hàng đủ điều kiện về giá và số lượng.</p>}
    <p className="mt-2 text-xs">Sỉ HCM: khách tự bố trí xe nhận hàng tại cửa hàng hoặc TP.HCM.</p>
  </aside>;
}
