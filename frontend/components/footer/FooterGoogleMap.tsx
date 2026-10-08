"use client";

import React from "react";
import { MapPin, ExternalLink, Navigation } from "lucide-react";

interface FooterGoogleMapProps {
  address?: string;
  directMapUrl?: string;
}

export function FooterGoogleMap({
  address = "90/2 Nguyễn Phúc Chu, Phường 15, Quận Tân Bình, TP.HCM",
  directMapUrl = "https://www.google.com/maps/search/?api=1&query=Aloha+Th%E1%BA%BF+Gi%E1%BB%9Bi+Ch%E1%BA%ADu+C%C3%A2y,+90/2+Nguy%E1%BB%85n+Ph%C3%BAc+Chu,+T%C3%A2n+B%C3%ACnh",
}: FooterGoogleMapProps) {
  // Google Maps embed URL chuẩn xác đến địa điểm doanh nghiệp Aloha Thế Giới Chậu Cây
  const embedUrl =
    "https://maps.google.com/maps?q=Aloha%20Th%E1%BA%BF%20Gi%E1%BB%9Bi%20Ch%E1%BA%ADu%20C%C3%A2y,%2090/2%20Nguy%E1%BB%85n%20Ph%C3%BAc%20Chu,%20T%C3%A2n%20B%C3%ACnh,%20H%E1%BB%93%20Ch%C3%AD%20Minh&t=&z=16&ie=UTF8&iwloc=&output=embed";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition duration-300 hover:shadow-md">
      {/* Khung iframe Bản đồ Google Maps */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100">
        <iframe
          title="Bản đồ vị trí showroom và xưởng Aloha Thế Giới Chậu Cây"
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen={false}
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full object-cover transition-opacity duration-300"
        />

        {/* Nút 'Mở trong Maps' nổi ở góc trên bên trái */}
        <a
          href={directMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-stone-800 shadow-xs backdrop-blur-xs transition hover:bg-white hover:text-[var(--aloha-green)]"
          aria-label="Mở địa chỉ trong Google Maps"
        >
          <span>Mở trong Maps</span>
          <ExternalLink size={12} className="text-stone-500" />
        </a>
      </div>

      {/* Dòng trạng thái tiện ích chân bản đồ: ngắn gọn, không lặp lại địa chỉ */}
      <div className="flex items-center justify-between px-3 py-2 text-[11px] bg-stone-50/80 border-t border-stone-100">
        <span className="text-stone-600 font-medium">
          Đỗ xe ô tô &amp; xe máy tiện lợi
        </span>
        <a
          href={directMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-[var(--aloha-green)] hover:underline"
        >
          <Navigation size={11} />
          <span>Chỉ đường</span>
        </a>
      </div>
    </div>
  );
}
