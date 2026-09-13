"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "../api";
import { WbBtn } from "../ui";

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const MAX_MB = 4;

export async function uploadAppearanceImage(
  file: File,
  kind: "banner" | "logo" | "favicon"
): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("Chỉ nhận JPG, PNG hoặc WebP");
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`Ảnh tối đa ${MAX_MB}MB`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
  const r = await websiteApi<{ url: string }>("/api/shop/admin/appearance/upload", {
    method: "POST",
    body: JSON.stringify({ data: dataUrl, kind }),
  });
  if (!r?.url) throw new Error("Upload thất bại");
  return r.url;
}

export function ImageUploadField({
  kind,
  value,
  onChange,
  hint,
  previewClassName,
  previewBg,
}: {
  kind: "banner" | "logo" | "favicon";
  value?: string;
  onChange: (url: string) => void;
  hint?: string;
  previewClassName?: string;
  /** Nền phía sau logo trong suốt (vd. màu theme). */
  previewBg?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAppearanceImage(file, kind);
      onChange(url);
      toast.success("Đã tải ảnh lên");
    } catch (e: any) {
      toast.error(e?.message || "Upload thất bại");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div
          className={
            previewClassName ||
            "overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          }
          style={previewBg ? { background: previewBg } : undefined}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            src={value}
            alt=""
            className={
              kind === "logo"
                ? "mx-auto h-12 w-auto max-w-full object-contain p-2"
                : "aspect-square w-full bg-[#F7F3EA] object-contain"
            }
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-[12px] text-gray-500 hover:border-[#3D6B3A]/50 hover:bg-[#F4F8F2]"
          style={{ borderStyle: "dashed" }}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#3D6B3A]" />
          ) : (
            <ImagePlus className="h-5 w-5 text-gray-400" />
          )}
          <span className="font-medium text-gray-700">
            {busy ? "Đang tải…" : "Kéo thả hoặc chọn ảnh"}
          </span>
          {hint ? <span className="text-[11px] text-gray-400">{hint}</span> : null}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <WbBtn
          variant="secondary"
          className="!h-8 !px-2.5"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {value ? "Đổi ảnh" : "Tải ảnh lên"}
        </WbBtn>
        {value ? (
          <WbBtn
            variant="ghost"
            className="!h-8 !px-2.5"
            disabled={busy}
            onClick={() => onChange("")}
          >
            Xóa
          </WbBtn>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
