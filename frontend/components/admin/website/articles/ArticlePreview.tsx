"use client";

import React from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Pencil, X } from "lucide-react";
import { WbBtn } from "../ui";
import {
  SHOP_PREVIEW_URL,
  bodyHtmlForPreview,
  type Article,
} from "./articleUtils";

export function ArticlePreview({
  preview,
  onClose,
  onEdit,
}: {
  preview: Article | null;
  onClose: () => void;
  onEdit: (article: Article) => void;
}) {
  if (!preview || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước bài viết"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0F9D58]">
              Xem trước (theo thứ tự form nhập)
            </p>
            <p className="truncate text-[13px] text-slate-500">
              /{preview.slug}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <WbBtn
              variant="ghost"
              className="!h-8 !px-2.5 text-[12px]"
              href={`${SHOP_PREVIEW_URL}/bai-viet/${encodeURIComponent(preview.slug)}`}
              title="Mở trên shop"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Shop
            </WbBtn>
            <WbBtn
              variant="secondary"
              className="!h-8 !px-2.5 text-[12px]"
              onClick={() => onEdit(preview)}
            >
              <Pencil className="h-3.5 w-3.5" /> Sửa
            </WbBtn>
            <button
              type="button"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              onClick={onClose}
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Thứ tự khớp form: tiêu đề → danh mục → ảnh → tóm tắt → nội dung → SP */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Tiêu đề
            </p>
            <h3 className="text-[22px] font-bold leading-snug text-slate-900">
              {preview.title}
            </h3>
            <p className="mt-2 text-[12px] text-slate-500">
              {preview.publishedAt
                ? new Date(preview.publishedAt).toLocaleString("vi-VN")
                : ""}
              {preview.visible ? " · Đang hiện trên web" : " · Đang ẩn"}
            </p>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Danh mục
            </p>
            {preview.category ? (
              <p className="text-[13px] font-bold uppercase tracking-wide text-[#0F9D58]">
                {preview.category}
              </p>
            ) : (
              <p className="text-[13px] text-slate-400">Chưa chọn</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Ảnh đại diện (card trang chủ)
            </p>
            {preview.coverUrl ? (
              <div className="overflow-hidden rounded-xl bg-[#F7F3EA]">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img
                  src={preview.coverUrl}
                  className="block h-auto w-full"
                />
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">Chưa có ảnh</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Video đại diện
            </p>
            {preview.videoUrl ? (
              <div className="overflow-hidden rounded-xl bg-slate-900">
                {/\.(mp4|webm|ogg)(\?|$)/i.test(preview.videoUrl) ||
                preview.videoUrl.includes("/uploads/") ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={preview.videoUrl}
                    controls
                    className="aspect-video w-full"
                    preload="metadata"
                  />
                ) : (
                  <iframe
                    src={
                      /embed\//i.test(preview.videoUrl)
                        ? preview.videoUrl
                        : preview.videoUrl.replace(
                            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
                            "https://www.youtube.com/embed/$1"
                          )
                    }
                    title="Video"
                    className="aspect-video w-full border-0"
                    allowFullScreen
                  />
                )}
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">Chưa có video</p>
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Tóm tắt
            </p>
            {preview.excerpt ? (
              <p className="text-[15px] font-medium leading-relaxed text-slate-700">
                {preview.excerpt}
              </p>
            ) : (
              <p className="text-[13px] text-slate-400">Chưa có tóm tắt</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Nội dung bài viết
            </p>
            <div
              className="article-body max-w-none text-[15px] leading-7 text-slate-800 [&_a]:font-bold [&_a]:text-[#0F9D58] [&_a]:underline [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_li]:my-1.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:tracking-[0.015em] [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_.article-video]:relative [&_.article-video]:my-3 [&_.article-video]:aspect-video [&_.article-video]:w-full [&_.article-video]:overflow-hidden [&_.article-video]:rounded-xl [&_.article-video]:bg-slate-900 [&_.article-video_iframe]:absolute [&_.article-video_iframe]:inset-0 [&_.article-video_iframe]:h-full [&_.article-video_iframe]:w-full [&_img]:my-3 [&_img]:h-auto [&_img]:w-full [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{
                __html: bodyHtmlForPreview(preview.bodyHtml || ""),
              }}
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Sản phẩm trong bài
            </p>
            {preview.productMas?.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[13px] text-slate-800">
                  {preview.productMas.join(", ")}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">Chưa gắn sản phẩm</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
