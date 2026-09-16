"use client";

import { SHOP_ORIGIN } from "@/lib/seo";

export function SeoGooglePreview({
  title,
  description,
  path = "/",
}: {
  title: string;
  description: string;
  path?: string;
}) {
  const host = SHOP_ORIGIN.replace(/^https?:\/\//, "");
  const urlPath = path.startsWith("/") ? path : `/${path}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-[#f8f9fa] p-4">
      <p className="truncate text-[18px] font-medium leading-snug text-[#1a0dab]">
        {title || "Tiêu đề trang"}
      </p>
      <p className="mt-0.5 truncate text-[13px] text-[#006621]">
        {host}
        {urlPath !== "/" ? urlPath : ""}
      </p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[#4d5156]">
        {description || "Mô tả hiển thị trên Google…"}
      </p>
      <p className="mt-3 text-[11px] font-semibold text-slate-400">
        Xem trước trên Google
      </p>
    </div>
  );
}

export function SeoTabPreview({
  title,
  faviconUrl,
}: {
  title: string;
  faviconUrl?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="inline-flex max-w-full items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-3 py-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl || "/brand/logo-icon.png"}
          alt=""
          className="h-4 w-4 rounded-sm object-contain"
        />
        <span className="max-w-[180px] truncate text-[12px] font-medium text-slate-700">
          {title || "Tab trình duyệt"}
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-slate-400">
        Xem trước tab trình duyệt
      </p>
    </div>
  );
}

export function SeoSocialPreview({
  title,
  description,
  imageUrl,
}: {
  title: string;
  description: string;
  imageUrl?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="aspect-[1.91/1] bg-slate-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-slate-400">
            Chưa có ảnh chia sẻ
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-[14px] font-bold text-slate-900">
          {title || "Tiêu đề chia sẻ"}
        </p>
        <p className="line-clamp-2 text-[12px] text-slate-500">
          {description || "Mô tả khi chia sẻ mạng xã hội…"}
        </p>
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-400">
        Xem trước trên mạng xã hội
      </p>
    </div>
  );
}
