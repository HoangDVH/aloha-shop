"use client";

import { ChevronLeft } from "lucide-react";
import { WbBtn } from "@/components/admin/website/ui";
import { useSeoAdminUiStore } from "./seoUiStore";

export function SeoEditorLayout({
  crumb,
  title,
  children,
  preview,
  onSave,
  onPublish,
  saving,
  publishing,
  dirty,
}: {
  crumb: string;
  title: string;
  children: React.ReactNode;
  preview: React.ReactNode;
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  publishing?: boolean;
  dirty?: boolean;
}) {
  const setPanel = useSeoAdminUiStore((s) => s.setPanel);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => setPanel("hub")}
            className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[var(--aloha-green)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Tối ưu hóa tìm kiếm (SEO) &gt; {crumb}
          </button>
          <h2 className="text-xl font-bold tracking-tight text-[var(--aloha-ink)]">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="text-[11px] font-semibold text-amber-600">
              Chưa lưu / chưa xuất bản
            </span>
          ) : null}
          {onSave ? (
            <WbBtn variant="secondary" disabled={saving} onClick={onSave}>
              {saving ? "Đang lưu…" : "Lưu nháp"}
            </WbBtn>
          ) : null}
          {onPublish ? (
            <WbBtn variant="primary" disabled={publishing} onClick={onPublish}>
              {publishing ? "Đang xuất bản…" : "Xuất bản"}
            </WbBtn>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[#e8eaed] bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-4 text-[13px] font-bold text-slate-800">Thiết lập SEO</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">{children}</div>
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">{preview}</div>
        </div>
      </div>
    </div>
  );
}
