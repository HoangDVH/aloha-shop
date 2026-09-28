"use client";

import React from "react";
import { wbInput } from "../../ui";
import { ArticleRichEditor } from "../ArticleRichEditor";
import type { FormState } from "../articleUtils";

export function SummaryContentSection({
  editing,
  patchEditing,
  setEditorBusy,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  setEditorBusy: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* Tóm tắt */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-1 text-[15px] font-bold text-slate-900">
          Tóm tắt (hiện dưới tiêu đề trên web)
        </h3>
        <p className="mb-4 text-[12px] text-slate-500">Mô tả ngắn giúp khách hiểu bài trước khi đọc.</p>
        <textarea
          className={`${wbInput} min-h-[96px] py-2.5`}
          value={editing.excerpt}
          maxLength={500}
          placeholder="Mô tả ngắn…"
          onChange={(e) => patchEditing({ ...editing, excerpt: e.target.value })}
        />
      </section>

      {/* Nội dung */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-1 text-[15px] font-bold text-slate-900">
          Nội dung bài viết <span className="text-red-500">*</span>
        </h3>
        <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
          Chèn ảnh → bấm ảnh để kéo góc / cắt (giữ nét). Có thể chọn nhiều ảnh. Video trong bài:
          YouTube hoặc Drive.
        </p>
        <ArticleRichEditor
          value={editing.bodyHtml}
          onChange={(bodyHtml) => patchEditing({ ...editing, bodyHtml })}
          onBusyChange={setEditorBusy}
        />
      </section>
    </>
  );
}
