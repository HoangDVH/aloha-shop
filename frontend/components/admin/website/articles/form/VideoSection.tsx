"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { WbBtn, wbInput } from "../../ui";
import { normalizeVideoInput } from "../articleMediaUtils";
import type { FormState } from "../articleUtils";

export function VideoSection({
  editing,
  patchEditing,
  videoFileRef,
  videoBusy,
  onVideoFile,
  videoNorm,
  videoPreviewSrc,
}: {
  editing: FormState;
  patchEditing: (next: FormState) => void;
  videoFileRef: React.RefObject<HTMLInputElement | null>;
  videoBusy: boolean;
  onVideoFile: (file: File | undefined) => Promise<void> | void;
  videoNorm: ReturnType<typeof normalizeVideoInput> | null;
  videoPreviewSrc: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-1 text-[15px] font-bold text-slate-900">Video đầu trang chi tiết</h3>
      <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
        Khác với video chèn trong nội dung bên dưới. YouTube, Google Drive (file đã chia sẻ “ai
        có link”), hoặc MP4 từ máy.
      </p>
      <input
        className={`${wbInput} mb-3`}
        value={editing.videoUrl}
        placeholder="https://youtu.be/… hoặc link Drive file…"
        onChange={(e) => patchEditing({ ...editing, videoUrl: e.target.value })}
        onBlur={() => {
          const s = editing.videoUrl.trim();
          if (!s) return;
          const n = normalizeVideoInput(s);
          if (n.kind === "invalid") {
            toast.error(n.reason);
            return;
          }
          const next = n.kind === "file" ? n.url : n.embedUrl;
          if (next !== s) patchEditing({ ...editing, videoUrl: next });
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={videoFileRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          className="hidden"
          onChange={(e) => void onVideoFile(e.target.files?.[0])}
        />
        <WbBtn
          variant="secondary"
          disabled={videoBusy}
          onClick={() => videoFileRef.current?.click()}
        >
          {videoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Chọn video từ máy
        </WbBtn>
        {editing.videoUrl ? (
          <WbBtn
            variant="ghost"
            onClick={() => patchEditing({ ...editing, videoUrl: "" })}
          >
            Xóa video
          </WbBtn>
        ) : null}
      </div>
      {videoPreviewSrc ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-slate-900">
          {videoNorm?.kind === "file" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={videoPreviewSrc}
              controls
              className="aspect-video w-full"
              preload="metadata"
            />
          ) : (
            <iframe
              src={videoPreviewSrc}
              title="Video preview"
              className="aspect-video w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
