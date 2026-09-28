"use client";

import React from "react";
import { Crop, FileText, Loader2 } from "lucide-react";
import { WbBtn } from "../../ui";
import type { FormState } from "../articleUtils";

export function CoverSection({
  editing,
  patchEditing,
  coverRef,
  coverBusy,
  onCoverFile,
  setCoverCropSrc,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  coverRef: React.RefObject<HTMLInputElement | null>;
  coverBusy: boolean;
  onCoverFile: (file: File | undefined) => Promise<void> | void;
  setCoverCropSrc: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-1 text-[15px] font-bold text-slate-900">Ảnh đại diện (card trang chủ)</h3>
      <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
        Chỉ hiện trên card danh sách — <strong className="text-slate-700">không</strong> hiện trang
        chi tiết. Cắt vuông 1:1 bằng cùng bộ công cụ (kéo / zoom).
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-[#F7F3EA] shadow-sm">
          {editing.coverUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={editing.coverUrl} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-300">
              <FileText className="h-8 w-8" />
              <span className="text-[11px]">Chưa có ảnh</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void onCoverFile(e.target.files?.[0])}
          />
          <WbBtn
            variant="secondary"
            disabled={coverBusy}
            onClick={() => coverRef.current?.click()}
          >
            {coverBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing.coverUrl ? "Đổi ảnh" : "Chọn ảnh"}
          </WbBtn>
          {editing.coverUrl ? (
            <>
              <WbBtn
                variant="secondary"
                disabled={coverBusy}
                onClick={() => setCoverCropSrc(editing.coverUrl)}
              >
                <Crop className="h-4 w-4" />
                Cắt lại
              </WbBtn>
              <WbBtn
                variant="ghost"
                onClick={() => patchEditing({ ...editing, coverUrl: "" })}
              >
                Xóa ảnh
              </WbBtn>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
