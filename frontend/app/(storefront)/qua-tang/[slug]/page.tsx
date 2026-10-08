import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Check, ArrowLeft, Heart, MessageCircle, Gift, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

interface GiftDetailData {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  recipientType: string;
  image: string;
  quote: string;
  includedItems: string;
  linkedProductCodes: string[];
  products?: any[];
}

async function getGiftDetail(slug: string): Promise<GiftDetailData | null> {
  try {
    const backendPort = process.env.SHOP_SERVER_PORT || 3001;
    const res = await fetch(`http://127.0.0.1:${backendPort}/api/shop/gifts/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gift = await getGiftDetail(slug);
  if (!gift) return { title: "Quà Tặng Cây Xanh | Aloha" };

  return {
    title: `${gift.title} | Quà Tặng Aloha`,
    description: gift.subtitle || "Món quà xanh độc bản chỉn chu từ chậu cây đến thiệp viết tay.",
    openGraph: {
      title: gift.title,
      description: gift.subtitle,
      images: [gift.image],
    },
  };
}

export default async function GiftDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gift = await getGiftDetail(slug);

  if (!gift) {
    notFound();
  }

  const products = gift.products || [];

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* ─────────────────────────────────────────────────────────────
          HERO STORY SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#FAF8F5] pt-8 pb-14 sm:pb-20 border-b border-stone-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb / Back button */}
          <div className="mb-6">
            <Link
              href="/#goi-y-qua-tang"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-[#0E5242] transition"
            >
              <ArrowLeft size={14} />
              <span>Quay lại Gợi ý quà tặng</span>
            </Link>
          </div>

          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Cột trái: Văn bản cảm xúc */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0E5242]">
                <Sparkles size={13} className="text-[#C05621]" />
                <span>{gift.tag}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wide text-[#0E5242] leading-tight">
                {gift.title}
              </h1>

              <p className="text-base sm:text-lg text-stone-700 font-medium italic">
                “{gift.subtitle}”
              </p>

              {gift.quote ? (
                <div className="border-l-[3.5px] border-[#D99A46] pl-5 py-1 text-sm sm:text-base text-stone-700 leading-relaxed">
                  {gift.quote}
                </div>
              ) : null}

              {/* Nút Tư vấn qua Zalo */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="https://zalo.me/0394107309"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0E5242] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#156e59]"
                >
                  <MessageCircle size={16} />
                  <span>Tư vấn đóng gói theo yêu cầu qua Zalo</span>
                </a>
              </div>
            </div>

            {/* Cột phải: Bức ảnh đại diện quà tặng (Khung vuông 1:1 thấy trọn vẹn toàn bộ ảnh) */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-3 shadow-xl">
                <div className="overflow-hidden rounded-2xl bg-stone-100 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gift.image}
                    alt={gift.title}
                    className="h-full w-full object-cover transition duration-500 hover:scale-103"
                  />
                </div>
                <div className="p-3 text-center">
                  <span className="text-xs font-semibold text-stone-600">
                    Ảnh chụp cây thật thực tế tại vườn Aloha Shop
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DANH SÁCH CÂY THẬT CÓ THỂ ĐẶT MUA NGAY
      ───────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-18 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0E5242]">
            Các gợi ý cây phù hợp
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-stone-900">
            Chọn Chậu Cây Yêu Thích Để Gửi Trao
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-500">
            Mỗi chậu cây đều được dưỡng rễ khỏe mạnh, phối chậu gốm thủ công tinh xảo và đóng gói cẩn thận.
          </p>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <ProductCard key={p._id || p.ma} product={p} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 rounded-2xl bg-white border border-stone-200/80 p-6">
            <Gift className="mx-auto h-10 w-10 text-stone-300 mb-2" />
            <p className="text-sm font-semibold text-stone-700">
              Nhóm quà tặng này đang cập nhật thêm cây mới vào bộ sưu tập.
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Bạn có thể liên hệ trực tiếp với Aloha để được nhân viên chụp ảnh các mẫu chậu thực tế tại vườn gửi bạn chọn nhé!
            </p>
            <div className="mt-4">
              <a
                href="https://zalo.me/0394107309"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0E5242] px-5 py-2 text-xs font-bold text-white shadow-sm"
              >
                <span>Nhắn tin Zalo chọn cây</span>
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
