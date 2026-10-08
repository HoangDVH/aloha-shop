"use client";

import React, { useState } from "react";
import { ExternalLink, CheckCircle2, ThumbsUp } from "lucide-react";

interface FooterFacebookCardProps {
  pageUrl?: string;
  pageName?: string;
}

export function FooterFacebookCard({
  pageUrl = "https://www.facebook.com/share/19iQ1PMqpx/?mibextid=wwXIfr",
  pageName = "Aloha Thế Giới Chậu Cây",
}: FooterFacebookCardProps) {
  const [iframeError, setIframeError] = useState(false);

  // Fallback Brand Card chuẩn các công ty lớn: Tải tức thì 0ms, không phụ thuộc script nặng Facebook,
  // 100% không bị AdBlocker chặn ô trắng, hiển thị sắc nét và sang trọng
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs transition duration-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        {/* Avatar thương hiệu AL */}
        <div className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#0E5242] to-[#1A6B56] text-white flex items-center justify-center font-serif text-sm font-bold shadow-xs">
          <span>AL</span>
        </div>

        {/* Thông tin Fanpage */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-xs font-bold text-stone-900">
              {pageName}
            </span>
            <CheckCircle2 size={13} className="shrink-0 text-[#1877F2] fill-[#1877F2] text-white" />
          </div>
          <p className="text-[11px] text-stone-500 truncate">
            2.800+ lượt theo dõi trên Facebook
          </p>
        </div>

        {/* Nút hành động Theo dõi / Ghé thăm */}
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2] text-[#1877F2] hover:text-white px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200"
          aria-label="Theo dõi Fanpage Aloha trên Facebook"
        >
          <svg className="size-3.5 fill-currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Theo dõi</span>
        </a>
      </div>
    </div>
  );
}
