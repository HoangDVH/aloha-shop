import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowRight, Building2, Gift, MessageCircle, Heart, ChevronRight } from "lucide-react";
import type { GiftCardItem } from "@/components/gift/HomeGiftSection";

export const metadata: Metadata = {
  title: "Gợi Ý Chọn Quà Tặng Ý Nghĩa | Aloha Gift Concierge",
  description:
    "Mỗi chậu cây là một thông điệp chân thành gửi trao — Tinh tế trong từng tán lá, chỉn chu từ chậu gốm đến thiệp viết tay mộc mạc tại Aloha Thế Giới Chậu Cây.",
  openGraph: {
    title: "Gợi Ý Chọn Quà Tặng | Aloha Gift Concierge",
    description: "Khám phá các bộ sưu tập quà tặng cây xanh cho nàng, gia đình, đối tác và đồng nghiệp.",
    images: ["/banners/ve-aloha/real-binh-an.jpg"],
  },
};

async function getAllGifts(): Promise<GiftCardItem[]> {
  try {
    const backendPort = process.env.SHOP_SERVER_PORT || 3001;
    const res = await fetch(`http://127.0.0.1:${backendPort}/api/shop/gifts`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.ok && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export default async function GiftsHubPage() {
  const gifts = await getAllGifts();

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* ─────────────────────────────────────────────────────────────
          HERO HEADER
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-stone-200/80 bg-[#FAF8F5]">
        {/* Họa tiết lá trang trí mờ tinh tế */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-top.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 z-0 h-40 w-40 opacity-15 sm:h-56 sm:w-56"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-bl.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-8 -bottom-8 z-0 h-40 w-40 opacity-15 sm:h-56 sm:w-56"
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 border border-emerald-200/80 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#0E5242]">
              <Sparkles size={13} className="text-[#C05621]" />
              <span>Aloha Gift Concierge</span>
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#0E5242]">
              GỢI Ý CHỌN QUÀ TẶNG
            </h1>

            {/* Nét cọ xanh vẽ tay */}
            <div className="mx-auto mt-2 h-2.5 w-44 overflow-hidden">
              <svg viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
                <path
                  d="M3 8.5C45 2.5 155 3.5 197 7"
                  stroke="#0E5242"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-80"
                />
              </svg>
            </div>

            <p className="mt-3 text-sm sm:text-base text-stone-600 leading-relaxed max-w-2xl mx-auto">
              Mỗi chậu cây là một thông điệp chân thành gửi trao — Tinh tế trong từng tán lá, chỉn chu từ chậu gốm đến thiệp viết tay mộc mạc.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DANH SÁCH CÁC BỘ SƯU TẬP QUÀ TẶNG
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0E5242]">
            Bộ Sưu Tập Quà Tặng Xanh
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-stone-900">
            Chọn Dịp Tặng Hoặc Đối Tượng Bạn Muốn Gửi Gắm
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-500">
            Bấm vào từng danh mục bên dưới để xem chi tiết câu chuyện, quy cách đóng gói và danh sách các mẫu chậu cây phù hợp.
          </p>
        </div>

        {/* Lưới các bộ sưu tập quà tặng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {gifts.map((item) => (
            <Link
              key={item._id || item.slug}
              href={`/qua-tang/${item.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aloha-green)] hover:shadow-lg cursor-pointer"
            >
              {/* Ảnh cây vuông 1:1 */}
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-103"
                />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-[#0E5242]/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {item.tag}
                </span>
              </div>

              {/* Thông tin */}
              <div className="mt-3.5 flex flex-1 flex-col">
                <h3 className="text-base font-bold text-stone-900 group-hover:text-[#0E5242] transition line-clamp-2 leading-snug">
                  {item.title}
                </h3>

                <p className="mt-1.5 text-xs text-stone-500 leading-relaxed line-clamp-2">
                  {item.subtitle || item.quote}
                </p>

                {/* Nút Khám phá */}
                <div className="mt-auto pt-4">
                  <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-50 py-2.5 text-xs font-bold text-[#0E5242] border border-stone-200/90 transition group-hover:bg-[#0E5242] group-hover:text-white group-hover:border-[#0E5242]">
                    <span>Xem các mẫu cây ({item.linkedProductCodes?.length || 0})</span>
                    <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Khối quà doanh nghiệp B2B (Hiển thị trọn vẹn 100% chữ, tối ưu nhỏ gọn trên Mobile) */}
        <div className="mt-8 sm:mt-12 rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4 text-left">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mt-0.5">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-stone-900 leading-snug">
                  Bạn cần đặt quà số lượng lớn cho công ty hoặc sự kiện?
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-stone-500 leading-relaxed">
                  Aloha hỗ trợ in logo doanh nghiệp lên chậu, khắc tag gỗ theo tên và xuất hóa đơn VAT đầy đủ theo yêu cầu.
                </p>
              </div>
            </div>

            <div className="sm:shrink-0 pt-0.5 sm:pt-0">
              <Link
                href="/qua-tang/doanh-nghiep"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-[#0E5242] px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#156e59] transition cursor-pointer"
              >
                <span>Xem hồ sơ dự án B2B</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
