"use client";

import type { ShopAddress } from "@/lib/orders";

type Props = {
  open: boolean;
  addresses: ShopAddress[];
  selectedAddrId: string;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onClose: () => void;
};

/** Modal chọn / thêm địa chỉ giao hàng. */
export function CheckoutAddressPickerModal({
  open,
  addresses,
  selectedAddrId,
  onSelect,
  onAddNew,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-extrabold text-[var(--aloha-ink)]">Chọn địa chỉ</h3>
        <ul className="mt-3 space-y-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={`w-full rounded-xl border-2 px-3 py-3 text-left ${
                  selectedAddrId === a.id
                    ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)]"
                    : "border-[var(--aloha-line)]"
                }`}
                onClick={() => onSelect(a.id)}
              >
                <p className="text-sm font-bold">
                  {a.fullName} · {a.phone}
                  {a.isDefault ? (
                    <span className="ml-2 text-[10px] text-[var(--aloha-green)]">Mặc định</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {a.detail}, {a.ward}, {a.province}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-[var(--aloha-green)] py-2.5 text-sm font-bold text-[var(--aloha-green)]"
          onClick={onAddNew}
        >
          + Thêm địa chỉ mới
        </button>
        <button type="button" className="mt-2 w-full py-2 text-sm text-slate-500" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
