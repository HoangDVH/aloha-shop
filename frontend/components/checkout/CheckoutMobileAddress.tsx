"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronRight, MapPin, Plus, X } from "lucide-react";
import { GhnAddressFields, type AddressDraft } from "@/components/GhnAddressFields";
import { createAddress, updateAddress, type ShopAddress } from "@/lib/orders";
import { checkoutShipAddressSchema } from "@/lib/checkoutSchemas";
import { EMPTY_DRAFT } from "./checkoutTypes";

type Props = {
  addresses: ShopAddress[];
  selectedAddr?: ShopAddress;
  draft: AddressDraft;
  showNewForm: boolean;
  userFullName?: string | null;
  userPhone?: string | null;
  onSelect: (id: string) => void;
  onSaved: (addresses: ShopAddress[], id: string) => void;
};

export function CheckoutMobileAddress(props: Props) {
  const { addresses, selectedAddr, draft, showNewForm, onSelect, onSaved } = props;
  const [screen, setScreen] = useState<"list" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [value, setValue] = useState<AddressDraft>(EMPTY_DRAFT);
  const [isDefault, setDefault] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const baseline = useRef("");
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const shown = showNewForm ? draft : selectedAddr;
  const dirty = JSON.stringify({ value, isDefault }) !== baseline.current;
  const valid = checkoutShipAddressSchema.safeParse({ customerName: value.fullName, customerPhone: value.phone,
    province: value.province, district: value.district, ward: value.ward, shippingAddress: value.detail }).success;

  function startEdit(address?: ShopAddress) {
    const next = address ? { ...EMPTY_DRAFT, ...address } : showNewForm ? { ...draft } : {
      ...EMPTY_DRAFT, fullName: props.userFullName || "", phone: props.userPhone || "",
    };
    const nextDefault = address?.isDefault ?? addresses.length === 0;
    setValue(next); setDefault(nextDefault); setEditingId(address?.id ?? null);
    baseline.current = JSON.stringify({ value: next, isDefault: nextDefault });
    setError(""); setScreen("edit");
  }
  function back() {
    if (busy) return;
    if (screen === "edit" && dirty) setConfirmExit(true);
    else setScreen(screen === "edit" ? "list" : null);
  }
  useEffect(() => {
    if (!screen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (media.matches) { setScreen(null); setConfirmExit(false); } };
    media.addEventListener("change", resize);
    return () => { document.body.style.overflow = previous; media.removeEventListener("change", resize); opener.current?.focus(); };
  }, [screen]);

  async function save() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    // Explicit fields preserve geographic IDs and avoid copying a saved address's id into the body.
    const body = { fullName: value.fullName.trim(), phone: value.phone.trim(), province: value.province,
      district: value.district, ward: value.ward, detail: value.detail.trim(),
      ghnProvinceId: value.ghnProvinceId, ghnDistrictId: value.ghnDistrictId,
      ghnWardCode: value.ghnWardCode, isDefault };
    try {
      if (editingId) { const result = await updateAddress(editingId, body); onSaved(result.addresses, editingId); }
      else { const result = await createAddress(body); onSaved(result.addresses, result.addressId); }
      setScreen(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Không lưu được địa chỉ. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  return <div className="lg:hidden">
    <button ref={opener} type="button" onClick={() => addresses.length ? setScreen("list") : startEdit()}
      className="flex w-full items-start gap-2.5 py-1.5 text-left cursor-pointer">
      <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" />
      <span className="min-w-0 flex-1 text-sm">
        {shown?.detail ? <><span className="block font-bold text-slate-900 leading-snug">{shown.fullName} <span className="font-medium text-slate-600">({shown.phone})</span></span>
          <span className="mt-0.5 block text-xs text-slate-700 leading-relaxed">{shown.detail}</span>
          <span className="block text-xs text-slate-500 leading-relaxed">{[shown.ward, shown.district, shown.province].filter(Boolean).join(", ")}</span></>
          : <span className="font-semibold text-slate-800">Thêm địa chỉ nhận hàng</span>}
      </span><ChevronRight size={18} className="mt-0.5 shrink-0 text-slate-400" />
    </button>
    {screen && createPortal(<div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={screen === "list" ? "Địa chỉ của bạn" : "Thông tin địa chỉ"}
      className="fixed inset-0 z-[120] flex flex-col bg-white outline-none lg:hidden"
      onKeyDown={e => {
        if (e.key === "Escape") { e.preventDefault(); if (confirmExit) setConfirmExit(false); else back(); }
        if (e.key === "Tab") {
          const elements = Array.from((confirmExit ? dialog.current?.querySelector('[data-exit-dialog]') : dialog.current)?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select:not(:disabled), textarea, [tabindex="0"]') || []);
          const first = elements[0], last = elements[elements.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="relative flex min-h-14 shrink-0 items-center justify-center border-b border-slate-100 px-14 pt-[env(safe-area-inset-top)]">
        <button type="button" aria-label="Quay lại" disabled={busy} onClick={back} className="absolute left-2 flex h-11 w-11 items-center justify-center"><ArrowLeft size={21} /></button>
        <h2 className="text-base font-bold">{screen === "list" ? "Địa chỉ của bạn" : editingId ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}</h2>
      </header>
      {screen === "list" ? <div className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
        <button type="button" onClick={() => startEdit()} className="flex min-h-14 w-full items-center gap-3 border-b border-slate-100 text-sm"><Plus size={20} className="text-slate-500" />Thêm địa chỉ<ChevronRight size={17} className="ml-auto text-slate-400" /></button>
        <ul>{addresses.map(a => <li key={a.id} className="flex gap-2 border-b border-slate-100 py-4">
          <button type="button" aria-pressed={!showNewForm && a.id === selectedAddr?.id} onClick={() => { onSelect(a.id); setScreen(null); }} className="min-w-0 flex-1 text-left text-sm leading-6">
            <span className="flex items-center gap-2 font-bold">{a.fullName}{!showNewForm && a.id === selectedAddr?.id && <Check size={16} className="text-[var(--aloha-green)]" />}</span>
            <span className="block text-slate-600">{a.phone}</span><span className="block">{a.detail}</span>
            <span className="block text-slate-600">{[a.ward, a.district, a.province].filter(Boolean).join(", ")}</span>
            {a.isDefault && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">Mặc định</span>}
          </button><button type="button" onClick={() => startEdit(a)} className="min-h-11 self-start px-2 text-xs font-semibold text-[var(--aloha-price)]">Chỉnh sửa</button>
        </li>)}</ul>
      </div> : <>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="[&_.auth-field]:min-h-12 [&_.auth-field]:rounded-xl [&_.auth-field]:border-0 [&_.auth-field]:bg-[#f4f4f5] [&_.auth-field]:text-base [&_:is(label,div)>span]:text-sm [&_:is(label,div)>span]:text-slate-800">
            <GhnAddressFields mobileLocationPicker value={value} onChange={patch => setValue(current => ({ ...current, ...patch }))} addressLabel="Chi tiết địa chỉ" />
          </div>
          <label className="mt-6 flex min-h-12 items-center justify-between gap-4 text-sm font-semibold">Đặt làm mặc định
            <input type="checkbox" role="switch" checked={isDefault} onChange={e => setDefault(e.target.checked)} className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-200 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-[var(--aloha-green)] checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]" />
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
        <footer className="shrink-0 border-t border-slate-100 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" disabled={!valid || busy} onClick={save} className="min-h-12 w-full rounded-full bg-[var(--aloha-green)] text-sm font-bold text-white disabled:opacity-40">{busy ? "Đang lưu…" : "Lưu"}</button>
        </footer>
      </>}
      {confirmExit && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 px-8">
        <div data-exit-dialog role="alertdialog" aria-modal="true" aria-labelledby="address-exit-title" aria-describedby="address-exit-description" className="relative w-full max-w-xs overflow-hidden rounded-2xl bg-white text-center shadow-xl">
          <button autoFocus type="button" aria-label="Tiếp tục chỉnh sửa" onClick={() => setConfirmExit(false)} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center"><X size={17} /></button>
          <h3 id="address-exit-title" className="px-10 pt-6 text-lg font-bold">Thoát chỉnh sửa?</h3>
          <p id="address-exit-description" className="px-6 pb-5 pt-2 text-sm text-slate-500">Thông tin bạn vừa thay đổi sẽ không được lưu.</p>
          <button type="button" onClick={() => setConfirmExit(false)} className="min-h-12 w-full border-t border-slate-100 text-sm font-bold">Tiếp tục chỉnh sửa</button>
          <button type="button" onClick={() => { setConfirmExit(false); setScreen("list"); }} className="min-h-12 w-full border-t border-slate-100 text-sm text-slate-500">Thoát</button>
        </div>
      </div>}
    </div>, document.body)}
  </div>;
}
