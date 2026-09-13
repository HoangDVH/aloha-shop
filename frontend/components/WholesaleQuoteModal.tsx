"use client";

import { useEffect } from "react";
import { MessageCircle, X } from "lucide-react";

export type WholesaleContact = {
  displayName: string;
  siteName: string;
  address: string;
  phone: string;
  zaloUrl: string;
  logoUrl: string;
};

function qrSrc(zaloUrl: string) {
  const data = encodeURIComponent(zaloUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${data}`;
}

/** Popup báo giá sỉ — bố cục giống trang liên hệ Zalo. */
export function WholesaleQuoteModal({
  open,
  onClose,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  contact: WholesaleContact;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="wholesale-quote-title">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b141a]/55 backdrop-blur-[2px]"
        aria-label="Đóng"
        onClick={onClose}
      />

      <div className="relative z-[1] w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Đóng"
        >
          <X size={18} />
        </button>

        <div className="grid gap-5 p-5 sm:grid-cols-[1.15fr_0.85fr] sm:gap-6 sm:p-6">
          <div className="min-w-0">
            <div className="flex items-start gap-3 pr-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={contact.logoUrl}
                alt=""
                width={52}
                height={52}
                className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0">
                <h2
                  id="wholesale-quote-title"
                  className="text-[15px] font-bold leading-snug text-[#1a1a1a] sm:text-base"
                >
                  {contact.displayName}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">Liên hệ</p>
              </div>
            </div>

            <a
              href={contact.zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0068ff] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0055d4] sm:w-auto sm:min-w-[10.5rem]"
            >
              <MessageCircle size={18} strokeWidth={2.25} aria-hidden />
              Nhắn tin
            </a>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-[#1a1a1a]">Giới thiệu bản thân</h3>
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-slate-700">
                <p>{contact.siteName}</p>
                <p>{contact.address}</p>
                <p>Sđt: {contact.phone}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl bg-[#f4f6f8] px-4 py-5 sm:bg-transparent sm:px-0 sm:py-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc(contact.zaloUrl)}
              alt="Mã QR Zalo ALOHA"
              width={180}
              height={180}
              className="h-[160px] w-[160px] rounded-lg bg-white p-2 shadow-sm ring-1 ring-black/5 sm:h-[180px] sm:w-[180px]"
            />
            <p className="mt-3 max-w-[14rem] text-center text-[11px] leading-snug text-slate-500">
              Mở Zalo, bấm quét QR để quét và xem trên điện thoại
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
