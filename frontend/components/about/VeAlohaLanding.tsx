import Link from "next/link";
import {
  Flower2,
  Handshake,
  Leaf,
  Shovel,
  Sparkles,
  Sprout,
} from "lucide-react";
import { SHOP_BRAND } from "@/lib/brand";

const WHY_CARDS = [
  {
    title: "Chậu bonsai · cảnh · decor",
    desc: "Đa dạng mẫu mã — tinh tế bền đẹp, sang trọng hiện đại, phù hợp mọi không gian.",
    image: "/banners/ve-aloha/card-01-chau.png",
    icon: Flower2,
  },
  {
    title: "Mang thiên nhiên vào không gian sống",
    desc: "Cây cảnh chọn lọc, chậu đẹp — tạo góc xanh tươi mát ngay trong ngôi nhà của bạn.",
    image: "/banners/ve-aloha/card-02-cay.png",
    icon: Leaf,
  },
  {
    title: "Hạt giống chất lượng",
    desc: "100% tự nhiên, tỉ lệ nảy mầm cao, dễ trồng dễ chăm — khởi nguồn cho sự sống.",
    image: "/banners/ve-aloha/card-03-hat.png",
    icon: Sprout,
  },
  {
    title: "Đất · dụng cụ chăm sóc cây",
    desc: "Giá thể, phân bón, bình xịt, găng tay và bộ dụng cụ — đủ đồ để cây khỏe đẹp.",
    image: "/banners/ve-aloha/card-04-dung-cu.png",
    icon: Shovel,
  },
  {
    title: "Ưu đãi & dịch vụ khách sỉ",
    desc: "Chiết khấu hấp dẫn, nguồn hàng ổn định, giao toàn quốc — đồng hành hợp tác lâu dài.",
    image: "/banners/ve-aloha/card-05-si.png",
    icon: Handshake,
  },
] as const;

export function VeAlohaLanding() {
  return (
    <div className="bg-white text-[var(--aloha-ink)]">
      {/* Banner — full-bleed, tỉ lệ giống hero trang chủ (2170×725) */}
      <section className="relative w-full overflow-hidden bg-[#FDF6E3]">
        <Link
          href="/tim"
          className="group relative block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
          aria-label="Khám phá sản phẩm Aloha"
          style={{ aspectRatio: "2170 / 725" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/banners/banner-ve-aloha.png?v=3"
            alt={`${SHOP_BRAND} — Mang thiên nhiên đến gần hơn với cuộc sống của bạn`}
            width={2170}
            height={725}
            className="absolute inset-0 block h-full w-full object-cover object-center [image-rendering:auto]"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
      </section>

      {/* Vì sao nên chọn */}
      <section className="relative overflow-hidden border-t border-[var(--aloha-line)] bg-[#FDFBF7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-tr.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 top-0 z-0 h-24 w-24 opacity-30 sm:h-36 sm:w-36"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-bl.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-2 bottom-0 z-0 h-20 w-20 opacity-25 sm:h-32 sm:w-32"
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--aloha-green)]">
              <Sparkles size={14} aria-hidden />
              Về chúng tôi
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--aloha-green-dark)] sm:text-[1.85rem]">
              Vì sao nên chọn {SHOP_BRAND}?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--aloha-muted)] sm:text-[15px]">
              Chúng tôi không chỉ bán cây và chậu — mà mang đến lối sống xanh, hiện đại và tràn đầy
              năng lượng tích cực. Mỗi sản phẩm đều được chọn lọc kỹ lưỡng để bạn an tâm tô điểm tổ
              ấm.
            </p>
          </div>

          {/* Ảnh vuông 1:1 — object-contain để thấy hết, không cắt / không đè icon */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
            {WHY_CARDS.map(({ title, desc, image, icon: Icon }) => (
              <article key={title} className="flex flex-col">
                <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--aloha-line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={title}
                    width={1024}
                    height={1024}
                    className="aspect-square w-full object-contain object-center"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="mt-3 flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--aloha-green)] text-white">
                    <Icon size={15} strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[13px] font-extrabold uppercase leading-snug tracking-wide text-[var(--aloha-green-dark)]">
                      {title}
                    </h2>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--aloha-muted)]">
                      {desc}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 sm:mt-14">
            <Link
              href="/tim"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--aloha-green-dark)] px-8 text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)]"
            >
              Khám phá sản phẩm →
            </Link>
            <p className="text-center text-base font-semibold italic text-[var(--aloha-green)] sm:text-lg">
              Cùng Aloha, lan tỏa màu xanh ♡
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
