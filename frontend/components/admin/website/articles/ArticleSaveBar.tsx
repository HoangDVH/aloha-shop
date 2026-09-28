"use client";

import React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { WbBtn } from "../ui";
import type { FormState } from "./articleUtils";

export function ArticleSaveBar({
  editing,
  dirty,
  mediaBusy,
  saving,
  closeEdit,
  save,
}: {
  editing: FormState;
  dirty: boolean;
  mediaBusy: boolean;
  saving: boolean;
  closeEdit: () => void;
  save: () => Promise<void> | void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Desktop fixed top bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] hidden sm:block">
        <div className="pointer-events-auto border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5">
            <button
              type="button"
              onClick={closeEdit}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Danh sách
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[14px] font-bold text-slate-900">
                {editing.id ? "Sửa bài viết" : "Tạo bài viết mới"}
              </p>
              <p className="text-[11px] text-slate-500">
                {dirty ? "Chưa lưu" : mediaBusy ? "Đang tải media…" : "Đã đồng bộ"}
              </p>
            </div>
            <WbBtn disabled={saving || mediaBusy} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lưu
            </WbBtn>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] sm:hidden">
        <div className="pointer-events-auto border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-slate-900">
                {editing.id ? "Sửa bài" : "Bài mới"}
              </p>
              <p className="text-[11px] text-slate-500">
                {dirty ? "Chưa lưu" : mediaBusy ? "Đang tải…" : "Đã đồng bộ"}
              </p>
            </div>
            <WbBtn variant="ghost" onClick={closeEdit}>
              Hủy
            </WbBtn>
            <WbBtn
              variant="primary"
              disabled={saving || mediaBusy}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lưu
            </WbBtn>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
