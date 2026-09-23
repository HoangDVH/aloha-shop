"use client";

import { MapPin, Store, Truck } from "lucide-react";
import { GhnAddressFields, type AddressDraft } from "@/components/GhnAddressFields";
import { AddressMergerAlert } from "@/components/AddressMergerAlert";
import type { ShopAddress } from "@/lib/orders";
import { EMPTY_DRAFT, type Delivery } from "./checkoutTypes";

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
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)]">
      <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold text-[var(--aloha-ink)]">
        <MapPin size={18} className="text-[var(--aloha-green)]" />
        Địa chỉ nhận hàng
      </h2>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {(
          [
            { id: "giao_tan_noi" as const, label: "Giao hàng tận nơi", Icon: Truck },
            { id: "nhan_cua_hang" as const, label: "Nhận tại cửa hàng", Icon: Store },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onDeliveryChange(id)}
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
              delivery === id
                ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)]"
                : "border-[var(--aloha-line)] bg-white hover:border-[#C5D5C0]"
            }`}
          >
            <Icon size={20} className="text-[var(--aloha-green)]" />
            <span className="text-sm font-bold text-[var(--aloha-ink)]">{label}</span>
          </button>
        ))}
      </div>

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
    </section>
  );
}
