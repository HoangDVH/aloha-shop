"use client";

import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Sparkles, X } from "lucide-react";
import { copyText } from "@/lib/shareMedia";
import { useToast } from "@/components/Toast";

export function ProductExtensionGuideModal({
  onClose,
  onCheckAgain,
}: {
  onClose: () => void;
  onCheckAgain: () => void;
}) {
  const toast = useToast();
  const [copiedPath, setCopiedPath] = useState(false);
  const extensionPath =
    "c:\\Users\\dauvu\\Downloads\\aloha-shop-standalone\\aloha-shop-standalone\\extensions\\aloha-facebook-extension";

  const handleCopyPath = async () => {
    const ok = await copyText(extensionPath);
    if (ok) {
      setCopiedPath(true);
      toast.push("Đã sao chép đường dẫn thư mục tiện ích!");
      setTimeout(() => setCopiedPath(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl space-y-4 border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 leading-tight">
                Cài tiện ích Aloha Auto Share
              </h3>
              <p className="text-[11px] text-stone-500">
                Tự động nạp toàn bộ ảnh vào Facebook (0đ - 30 giây)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 3 Bước cài đặt */}
        <div className="space-y-2.5 text-xs text-stone-700">
          <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-2.5 border border-stone-200/80">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-[11px]">
              1
            </span>
            <div>
              <p className="font-semibold text-stone-900">Mở trang Tiện ích của Chrome</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Nhập <code className="rounded bg-stone-200 px-1 py-0.5 text-stone-800">chrome://extensions</code> vào thanh địa chỉ của Chrome/Cốc Cốc rồi nhấn Enter.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-2.5 border border-stone-200/80">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-[11px]">
              2
            </span>
            <div>
              <p className="font-semibold text-stone-900">Bật Chế độ cho nhà phát triển</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Gạt công tắc <strong>Developer mode</strong> ở góc trên bên phải màn hình.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-2.5 border border-stone-200/80">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-[11px]">
              3
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">Tải tiện ích đã giải nén</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Bấm nút <strong>Tải tiện ích đã giải nén</strong> (Load unpacked) ở góc trên bên trái &rarr; chọn thư mục tiện ích Aloha:
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-white p-1.5 border border-stone-200">
                <input
                  type="text"
                  readOnly
                  value={extensionPath}
                  className="w-full bg-transparent text-[10px] font-mono text-stone-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-stone-100 hover:bg-stone-200 px-2 py-1 text-[10px] font-bold text-stone-700 transition"
                >
                  {copiedPath ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  <span>{copiedPath ? "Đã chép" : "Chép đường dẫn"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Nút tải về cho máy tính khác */}
        <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 p-2.5 border border-emerald-200">
          <div>
            <p className="text-xs font-bold text-emerald-950">Dành cho máy tính khác hoặc CTV</p>
            <p className="text-[11px] text-emerald-700">Tải file .zip về máy rồi giải nén ra thư mục</p>
          </div>
          <a
            href="/downloads/aloha-extension.zip"
            download="aloha-extension.zip"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
          >
            <Download size={13} />
            <span>Tải file .zip</span>
          </a>
        </div>

        {/* Nút hoàn tất */}
        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onCheckAgain();
              onClose();
            }}
            className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-xs font-bold transition shadow-xs"
          >
            Tôi đã cài đặt xong &rarr; Kiểm tra kết nối
          </button>
        </div>
      </div>
    </div>
  );
}
