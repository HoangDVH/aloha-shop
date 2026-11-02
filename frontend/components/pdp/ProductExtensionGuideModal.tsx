"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, FolderArchive, Layers, Sparkles, X } from "lucide-react";
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
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedDevPath, setCopiedDevPath] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      setIsLocalhost(h === "localhost" || h === "127.0.0.1");
    }
  }, []);

  const handleCopyExtensionsUrl = async () => {
    const ok = await copyText("chrome://extensions");
    if (ok) {
      setCopiedUrl(true);
      toast.push("Đã chép chrome://extensions vào khay nhớ tạm!");
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const devLocalPath =
    "c:\\Users\\dauvu\\Downloads\\aloha-shop-standalone\\aloha-shop-standalone\\extensions\\aloha-facebook-extension";

  const handleCopyDevPath = async () => {
    const ok = await copyText(devLocalPath);
    if (ok) {
      setCopiedDevPath(true);
      toast.push("Đã chép đường dẫn thư mục dev!");
      setTimeout(() => setCopiedDevPath(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl space-y-4 border border-stone-200 max-h-[90vh] overflow-y-auto">
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
            className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* 3 Bước cài đặt chuẩn cho mọi máy tính */}
        <div className="space-y-3 text-xs text-stone-700">
          {/* Bước 1 */}
          <div className="rounded-2xl bg-stone-50/90 p-3 border border-stone-200/80 space-y-2">
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-[11px]">
                1
              </span>
              <div className="flex-1">
                <p className="font-semibold text-stone-900">Tải về & giải nén tiện ích</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Tải file cài đặt về máy, sau đó chuột phải vào file chọn <strong>Giải nén tất cả... (Extract All)</strong>.
                </p>
              </div>
            </div>
            <div className="pl-7">
              <a
                href="/downloads/aloha-extension.zip"
                download="aloha-extension.zip"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
              >
                <Download size={14} />
                <span>Tải file tiện ích (aloha-extension.zip)</span>
              </a>
            </div>
          </div>

          {/* Bước 2 */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-stone-50/90 p-3 border border-stone-200/80">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-[11px]">
              2
            </span>
            <div className="flex-1 space-y-1.5">
              <div>
                <p className="font-semibold text-stone-900">Mở Tiện ích trình duyệt & Bật Developer mode</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Mở tab mới trên Chrome / Cốc Cốc rồi dán địa chỉ bên dưới:
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white p-1.5 border border-stone-200">
                <code className="flex-1 text-[11px] font-mono text-stone-700 pl-1 select-all">
                  chrome://extensions
                </code>
                <button
                  type="button"
                  onClick={handleCopyExtensionsUrl}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-stone-100 hover:bg-stone-200 px-2 py-1 text-[10px] font-bold text-stone-700 transition cursor-pointer"
                >
                  {copiedUrl ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  <span>{copiedUrl ? "Đã chép" : "Chép"}</span>
                </button>
              </div>
              <p className="text-[11px] text-stone-500">
                Sau đó gạt bật công tắc <strong>Chế độ cho nhà phát triển (Developer mode)</strong> ở góc trên bên phải màn hình.
              </p>
            </div>
          </div>

          {/* Bước 3 */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-stone-50/90 p-3 border border-stone-200/80">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-[11px]">
              3
            </span>
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-stone-900">Tải tiện ích đã giải nén</p>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Bấm nút <strong>Tải tiện ích đã giải nén (Load unpacked)</strong> ở góc trên bên trái trình duyệt &rarr; Chọn thư mục tiện ích vừa giải nén (trong thư mục <em>Downloads</em> trên máy bạn).
              </p>
            </div>
          </div>
        </div>

        {/* Developer local shortcut chỉ hiện khi chạy trên localhost */}
        {isLocalhost && (
          <div className="rounded-xl bg-amber-50/80 p-2.5 border border-amber-200/80 text-[11px] text-amber-900 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-950">Phím tắt cho máy Dev (Localhost):</span>
              <button
                type="button"
                onClick={handleCopyDevPath}
                className="inline-flex items-center gap-1 rounded bg-amber-100 hover:bg-amber-200 px-2 py-0.5 font-bold text-[10px] text-amber-900 transition cursor-pointer"
              >
                {copiedDevPath ? <Check size={10} className="text-emerald-700" /> : <Copy size={10} />}
                <span>{copiedDevPath ? "Đã chép" : "Chép thư mục repo"}</span>
              </button>
            </div>
            <p className="text-[10px] font-mono text-amber-800 break-all select-all">
              {devLocalPath}
            </p>
          </div>
        )}

        {/* Nút hoàn tất */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              onCheckAgain();
              onClose();
            }}
            className="w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white py-3 text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
          >
            Tôi đã cài đặt xong &rarr; Kiểm tra kết nối
          </button>
        </div>
      </div>
    </div>
  );
}
