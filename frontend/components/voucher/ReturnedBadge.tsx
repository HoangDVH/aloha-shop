import { RotateCcw } from "lucide-react";

export type VoucherReturnInfo = { orderCode: string; reason: "cancelled" | "expired" };

/** Nhãn "voucher đã được hoàn" khi đơn dùng nó trước đó bị huỷ / quá hạn thanh toán. */
export function ReturnedBadge({ info }: { info: VoucherReturnInfo }) {
  return (
    <p className="flex items-start gap-1 rounded-md bg-sky-50 px-1.5 py-1 text-[10.5px] font-semibold leading-snug text-sky-800 ring-1 ring-sky-100">
      <RotateCcw size={11} className="mt-px shrink-0" aria-hidden />
      <span>
        Đã hoàn lại · đơn {info.orderCode} {info.reason === "expired" ? "quá hạn thanh toán" : "đã huỷ"}
      </span>
    </p>
  );
}
