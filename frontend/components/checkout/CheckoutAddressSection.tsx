"use client";

import { MapPin, Store, Truck } from "lucide-react";
import { GhnAddressFields, type AddressDraft } from "@/components/GhnAddressFields";
import { AddressMergerAlert } from "@/components/AddressMergerAlert";
import type { ShopAddress } from "@/lib/orders";
import { EMPTY_DRAFT, type Delivery } from "./checkoutTypes";
import { CheckoutMobileAddress } from "./CheckoutMobileAddress";

type Props = {
  delivery: Delivery;
  onDeliveryChange: (d: Delivery) => void;
  draft: AddressDraft;
  onDraftChange: (patch: Partial<AddressDraft>) => void;
  addresses: ShopAddress[];
  selectedAddr: ShopAddress | undefined;
  showNewForm: boolean;
  onShowNewForm: () => void;
  onOpenPicker: () => void;
  onChooseSaved: () => void;
  userFullName?: string | null;
  userPhone?: string | null;
  onSelectAddress: (id: string) => void;
  onAddressSaved: (addresses: ShopAddress[], id: string) => void;
};

/** Khối địa chỉ nhận hàng (giao tận nơi / nhận cửa hàng). */
export function CheckoutAddressSection({
  delivery,
  onDeliveryChange,
  draft,
  onDraftChange,
  addresses,
  selectedAddr,
  showNewForm,
  onShowNewForm,
  onOpenPicker,
  onChooseSaved,
  userFullName,
  userPhone,
  onSelectAddress,
  onAddressSaved,
}: Props) {
  return (
    <section
      id="checkout-address-section"
      className="w-full bg-white px-4 py-2.5 sm:rounded-2xl sm:p-5 sm:shadow-sm sm:ring-1 sm:ring-[var(--aloha-line)] transition-all duration-300 scroll-mt-24"
    >
      <h2 className="sr-only lg:not-sr-only lg:mb-4 lg:flex lg:items-center lg:gap-2 lg:text-base lg:font-extrabold lg:text-[var(--aloha-ink)]">
        <MapPin size={18} className="text-[var(--aloha-green)]" />
        Địa chỉ nhận hàng
      </h2>

      <div role="group" aria-label="Hình thức nhận hàng" className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 lg:mb-4 lg:gap-2 lg:rounded-none lg:bg-transparent lg:p-0">
        {(
          [
            { id: "giao_tan_noi" as const, label: "Giao hàng tận nơi", Icon: Truck },
            { id: "nhan_cua_hang" as const, label: "Nhận tại cửa hàng", Icon: Store },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={delivery === id}
            onClick={() => onDeliveryChange(id)}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border-0 px-2 py-2 text-center transition lg:justify-start lg:gap-3 lg:rounded-xl lg:border-2 lg:px-4 lg:py-3 lg:text-left ${
              delivery === id
                ? "bg-white shadow-sm lg:border-[var(--aloha-green)] lg:bg-[var(--aloha-green-light)] lg:shadow-none"
                : "bg-transparent lg:border-[var(--aloha-line)] lg:bg-white lg:hover:border-[#C5D5C0]"
            }`}
          >
            <Icon size={20} className="h-4 w-4 shrink-0 text-[var(--aloha-green)] lg:h-5 lg:w-5" />
            <span className="text-xs font-bold text-[var(--aloha-ink)] lg:text-sm">{label}</span>
          </button>
        ))}
      </div>

      {delivery === "giao_tan_noi" && (
        <CheckoutMobileAddress addresses={addresses} selectedAddr={selectedAddr}
          draft={draft} showNewForm={showNewForm} userFullName={userFullName} userPhone={userPhone}
          onSelect={onSelectAddress} onSaved={onAddressSaved} />
      )}
      <div className={delivery === "giao_tan_noi" ? "hidden lg:block" : ""}>
      {delivery === "giao_tan_noi" ? (
        showNewForm || !selectedAddr ? (
          <div className="rounded-xl bg-[var(--aloha-cream)]/80 p-4">
            <GhnAddressFields
              value={draft}
              onChange={(p) => onDraftChange(p)}
            />
            {addresses.length > 0 ? (
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-[var(--aloha-green)]"
                onClick={onChooseSaved}
              >
                Chọn địa chỉ đã lưu
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-[#D5E3D0] bg-[#F7FBF5] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[var(--aloha-ink)]">
                  {selectedAddr.fullName} · {selectedAddr.phone}
                  {selectedAddr.isDefault ? (
                    <span className="ml-2 rounded bg-[var(--aloha-green)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Mặc định
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedAddr.detail}
                  {selectedAddr.ward ? `, ${selectedAddr.ward}` : ""}
                  {selectedAddr.district ? `, ${selectedAddr.district}` : ""}
                  {selectedAddr.province ? `, ${selectedAddr.province}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                  onClick={onOpenPicker}
                >
                  Thay đổi
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
                  onClick={() => {
                    onDraftChange({
                      ...EMPTY_DRAFT,
                      fullName: userFullName || "",
                      phone: userPhone || "",
                    });
                    onShowNewForm();
                  }}
                >
                  Thêm mới
                </button>
              </div>
            </div>

            <AddressMergerAlert
              province={selectedAddr.province}
              district={selectedAddr.district}
              ward={selectedAddr.ward}
              detail={selectedAddr.detail}
              onApply={(suggest) => {
                onDraftChange({
                  ...EMPTY_DRAFT,
                  fullName: selectedAddr.fullName,
                  phone: selectedAddr.phone,
                  province: suggest.province,
                  district: suggest.district || "",
                  ward: suggest.ward || selectedAddr.ward || "",
                  detail: selectedAddr.detail,
                });
                onShowNewForm();
              }}
              className="mt-3"
            />
          </div>
        )
      ) : (
        <div className="space-y-3 rounded-xl bg-[var(--aloha-cream)]/80 p-4">
          <p className="text-sm text-slate-600">
            Nhận tại cửa hàng ALOHA — 90/2 Nguyễn Phúc Chu, P.15, Tân Bình, TP.HCM
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="auth-field"
              placeholder="Tên người nhận *"
              value={draft.fullName}
              onChange={(e) => onDraftChange({ fullName: e.target.value })}
            />
            <input
              className="auth-field"
              placeholder="SĐT *"
              value={draft.phone}
              onChange={(e) => onDraftChange({ phone: e.target.value })}
            />
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
