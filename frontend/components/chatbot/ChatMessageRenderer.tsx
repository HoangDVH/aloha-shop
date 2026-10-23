"use client";

import React from "react";
import {
  ExternalLink,
  Tag,
  Home,
  Droplets,
  MapPin,
  Clock,
  Package,
  ShieldCheck,
  Sparkles,
  Info,
  Layers,
  Ruler,
  CheckCircle2,
} from "lucide-react";

/**
 * Trình dựng tin nhắn chuẩn công ty lớn:
 * - Khử toàn bộ dấu markdown thô sơ (**...**, *...*) thành Typography và Badge cao cấp.
 * - Nhận diện thông số sản phẩm (Giá, Ứng dụng, Chăm sóc, Kích thước...) thành các thẻ Feature Card rõ ràng.
 * - Tách phần kêu gọi Zalo (Xem ảnh thực tế, chốt đơn) thành Action Card Zalo chuyên nghiệp với nút bấm lớn.
 * - Tự động hợp nhất các dòng cụt hoặc ký tự lơ lửng, không bao giờ để chữ bị thiếu hay đứt đoạn.
 */

// Hàm parse chữ in đậm **...**
function renderFormattedInlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function getFeatureIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("giá") || l.includes("tiền") || l.includes("voucher") || l.includes("chiết khấu")) {
    return <Tag size={14} className="text-[#C62828]" />;
  }
  if (l.includes("ứng dụng") || l.includes("vị trí") || l.includes("không gian") || l.includes("decor") || l.includes("bàn")) {
    return <Home size={14} className="text-[#2D5A27]" />;
  }
  if (l.includes("chăm sóc") || l.includes("tưới") || l.includes("nước") || l.includes("ánh sáng") || l.includes("lọc")) {
    return <Droplets size={14} className="text-blue-600" />;
  }
  if (l.includes("kích thước") || l.includes("size") || l.includes("đường kính") || l.includes("chiều cao")) {
    return <Ruler size={14} className="text-amber-700" />;
  }
  if (l.includes("chất liệu") || l.includes("chậu") || l.includes("đá mài") || l.includes("composite")) {
    return <Layers size={14} className="text-slate-700" />;
  }
  if (l.includes("địa chỉ") || l.includes("vườn") || l.includes("showroom")) {
    return <MapPin size={14} className="text-rose-600" />;
  }
  if (l.includes("giờ") || l.includes("thời gian") || l.includes("mở cửa")) {
    return <Clock size={14} className="text-indigo-600" />;
  }
  if (l.includes("trạng thái") || l.includes("đơn hàng") || l.includes("giao hàng")) {
    return <Package size={14} className="text-emerald-700" />;
  }
  return <CheckCircle2 size={14} className="text-[#2D5A27]" />;
}

export function ChatMessageRenderer({
  content,
  zaloHref,
  onFollowUpClick,
}: {
  content: string;
  zaloHref: string;
  onFollowUpClick?: (text: string) => void;
}) {
  // Tiền xử lý: Gộp các dòng cụt (ví dụ "📸 Để", "👉 Xem") với dòng kế tiếp để không bao giờ bị đứt câu
  const sanitized = content
    .replace(/\n\s*([📸📲👉🌿✨🪴*•-]?\s*[A-Za-zÀ-ỹ0-9]{1,12})\s*\n+/g, " $1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 1. Phân tách thành từng khối nội dung
  const rawParagraphs = sanitized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-slate-800">
      {rawParagraphs.map((paragraph, pIdx) => {
        // Kiểm tra xem đoạn này có phải là lời kêu gọi hành động Zalo không
        const isZaloCta =
          (paragraph.includes("Zalo") || paragraph.includes("079 490 1233")) &&
          (paragraph.includes("ảnh thực tế") ||
            paragraph.includes("tại vườn") ||
            paragraph.includes("chốt đơn") ||
            paragraph.includes("duyệt") ||
            paragraph.includes("hình ảnh") ||
            paragraph.includes("chụp") ||
            paragraph.includes("gửi ảnh") ||
            paragraph.includes("📲"));

        if (isZaloCta) {
          return (
            <div
              key={pIdx}
              className="mt-2 flex items-center justify-between gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-3 py-2 text-xs shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0068FF] text-[10px] font-black text-white">
                  Zalo
                </span>
                <span className="truncate font-medium text-slate-800 text-[11.5px]">
                  Xem ảnh cây thực tế tại vườn
                </span>
              </div>
              <a
                href={zaloHref}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#0068FF] hover:bg-[#0057D9] px-3 py-1 text-[11px] font-bold text-white shadow-xs transition-all active:scale-95"
              >
                <span>Mở Zalo</span>
                <ExternalLink size={11} />
              </a>
            </div>
          );
        }

        // Kiểm tra xem đoạn này có chứa danh sách gạch đầu dòng thông số không (* hoặc - hoặc • hoặc 🪴)
        const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean);
        const bulletLines = lines.filter((l) => /^[*•-]|^(🪴|🌿|🌱)\s/.test(l));

        if (bulletLines.length > 0 && bulletLines.length >= lines.length - 1) {
          // Hiển thị danh sách thông số thoáng đãng, sang trọng, không bị đóng khung cứng nhắc
          return (
            <div
              key={pIdx}
              className="space-y-1.5 rounded-xl bg-white/70 border border-slate-200/70 p-2.5 text-xs shadow-2xs"
            >
              {bulletLines.map((line, bIdx) => {
                // Tách phần "* **Nhãn:** Giá trị" hoặc "🪴 **Nhãn:** Giá trị"
                const cleaned = line.replace(/^([*•-]|🪴|🌿|🌱)\s+/, "");
                const match = cleaned.match(/^\*\*([^*]+):\*\*\s*(.*)$/);

                if (match) {
                  const label = match[1].trim();
                  const value = match[2].trim();
                  const isPrice = label.toLowerCase().includes("giá");

                  return (
                    <div
                      key={bIdx}
                      className="flex items-start gap-2 text-xs leading-relaxed"
                    >
                      <div className="mt-0.5 shrink-0">{getFeatureIcon(label)}</div>
                      <div className="min-w-0 flex-1">
                        <strong className="font-semibold text-slate-900 mr-1.5">
                          {label}:
                        </strong>
                        {isPrice ? (
                          <span className="inline-block rounded-md bg-red-50 border border-red-200/80 px-2 py-0.2 text-xs font-bold text-[#C62828]">
                            {value}
                          </span>
                        ) : (
                          <span className="text-slate-700">
                            {renderFormattedInlineText(value)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // Dòng gạch đầu dòng thông thường
                return (
                  <div key={bIdx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2D5A27] mt-1.5 shrink-0" />
                    <span className="flex-1">
                      {renderFormattedInlineText(cleaned)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }

        // Đoạn văn thông thường (lời chào, kết luận, giải thích)
        return (
          <p key={pIdx} className="leading-relaxed text-[12.5px] text-slate-800">
            {renderFormattedInlineText(paragraph)}
          </p>
        );
      })}
    </div>
  );
}
