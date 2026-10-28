import { Info } from "lucide-react";

export type OrderItemDetail = {
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  sellPrice: number;
  lineTotal: number;
  variantLabel: string;
  imageUrl: string;
  note: string;
  isWholesale: boolean;
  isGift: boolean;
};

export function OrderProductsTable({ items }: { items: OrderItemDetail[] }) {
  return (
    <div className="rounded border border-slate-300 overflow-hidden bg-white shadow-2xs">
      <table className="w-full text-left text-[13px] border-collapse">
        <thead>
          <tr className="bg-[#f5f5f5] text-slate-900 font-bold border-b border-slate-300">
            <th className="py-3 px-3.5 w-36">Mã hàng</th>
            <th className="py-3 px-3.5">Tên hàng</th>
            <th className="py-3 px-3.5 text-center w-28">Số lượng</th>
            <th className="py-3 px-3.5 text-right w-32">Đơn giá</th>
            <th className="py-3 px-3.5 text-right w-28">Giảm giá</th>
            <th className="py-3 px-3.5 text-right w-32">Giá bán</th>
            <th className="py-3 px-3.5 text-right w-36">Thành tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((it, idx) => (
            <tr key={idx} className="hover:bg-slate-50 transition">
              <td className="py-3.5 px-3.5 font-bold text-blue-600 hover:underline cursor-pointer font-mono text-[13px]">
                {it.productCode}
              </td>
              <td className="py-3.5 px-3.5 text-slate-900 text-[13px]">
                <div className="font-bold uppercase tracking-tight text-slate-900">
                  {it.productName}
                </div>
                {it.variantLabel ? (
                  <div className="text-xs text-slate-600 font-semibold mt-0.5">
                    ({it.variantLabel.toUpperCase()})
                  </div>
                ) : null}

                {it.isGift ? (
                  <span className="inline-block text-xs font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 mt-1">
                    Quà tặng 0đ
                  </span>
                ) : null}

                {it.note ? (
                  <div className="mt-1.5 rounded bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs text-sky-950 font-medium flex items-start gap-1.5">
                    <Info size={13} className="shrink-0 text-sky-700 mt-0.5" />
                    <span>{it.note}</span>
                  </div>
                ) : null}
              </td>
              <td className="py-3.5 px-3.5 text-center tabular-nums text-[13px]">
                <span className="font-bold text-slate-900">{it.quantity}</span>
                <span className="text-slate-500 font-bold">/</span>
                <span className="text-red-600 font-extrabold">0</span>
              </td>
              <td className="py-3.5 px-3.5 text-right text-slate-900 font-medium tabular-nums text-[13px]">
                {it.price.toLocaleString("vi-VN")}
              </td>
              <td className="py-3.5 px-3.5 text-right text-slate-900 font-medium tabular-nums text-[13px]">
                {it.discount > 0 ? it.discount.toLocaleString("vi-VN") : "0"}
              </td>
              <td className="py-3.5 px-3.5 text-right text-slate-900 font-medium tabular-nums text-[13px]">
                {it.sellPrice.toLocaleString("vi-VN")}
              </td>
              <td className="py-3.5 px-3.5 text-right font-bold text-slate-900 tabular-nums text-[13px]">
                {it.lineTotal.toLocaleString("vi-VN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
