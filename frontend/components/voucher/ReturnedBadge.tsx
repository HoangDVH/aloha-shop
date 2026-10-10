import { RotateCcw } from "lucide-react";

export type VoucherReturnInfo = { orderCode: string; reason: "cancelled" | "expired" };

/** Nhãn "voucher đã được hoàn" khi đơn dùng nó trước đó bị huỷ / quá hạn thanh toán. */
export function ReturnedBadge({ info }: { info: VoucherReturnInfo }) {
  return (
    <p className="flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-semibold leading-tight text-sky-800 ring-1 ring-sky-100">
      <RotateCcw size={10} className="shrink-0" aria-hidden />
      <span>
        Đã hoàn lại · đơn {info.orderCode} {info.reason === "expired" ? "quá hạn" : "đã huỷ"}
      </span>
    </p>
  );
}
