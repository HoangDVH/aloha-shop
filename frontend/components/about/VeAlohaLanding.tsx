import Link from "next/link";
import { Handshake, Leaf, Shovel, Sprout } from "lucide-react";
import { SHOP_BRAND } from "@/lib/brand";
import { CustomerReviews } from "./CustomerReviews";
import { CUSTOMER_REVIEWS_SEED } from "./customerReviewsSeed";

const WHY_CARDS = [
  {
    title: "Mang thiên nhiên vào không gian sống",
    desc: "Cây cảnh chọn lọc, chậu đẹp — tạo góc xanh tươi mát ngay trong ngôi nhà của bạn.",
    icon: Leaf,
    image: "/banners/ve-aloha/card-02-cay.png",
  },
  {
    title: "Hạt giống chất lượng",
    desc: "100% tự nhiên, tỉ lệ nảy mầm cao, dễ trồng dễ chăm — khởi nguồn cho sự sống.",
    icon: Sprout,
    image: "/banners/ve-aloha/card-03-hat.png",
  },
  {
    title: "Đất · dụng cụ chăm sóc cây",
    desc: "Giá thể, phân bón, bình xịt, găng tay và bộ dụng cụ — đủ đồ để cây khỏe đẹp.",
    icon: Shovel,
    image: "/banners/ve-aloha/card-04-dung-cu.png",
  },
  {
    title: "Ưu đãi & dịch vụ khách sỉ",
    desc: "Chiết khấu hấp dẫn, nguồn hàng ổn định, giao toàn quốc — đồng hành hợp tác lâu dài.",
    icon: Handshake,
    image: "/banners/ve-aloha/card-05-uudai.png",
  },
] as const;

export function VeAlohaLanding() {
  return (
    <div className="bg-white text-[var(--aloha-ink)]">
      {/* Vì sao nên chọn */}
      <section className="relative overflow-hidden border-t border-[var(--aloha-line)] bg-[#FDFBF7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-tr.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 top-0 z-0 h-24 w-24 opacity-10 sm:h-36 sm:w-36"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-bl.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-2 bottom-0 z-0 h-20 w-20 opacity-10 sm:h-32 sm:w-32"
        />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-5 py-7 sm:px-8 lg:min-h-[calc(100svh-var(--shop-chrome-h,140px))] lg:py-7">
          <div className="order-1 mx-auto max-w-4xl text-center mb-5">
            <h1 className="text-2xl font-bold leading-snug tracking-normal text-stone-800 sm:text-[1.85rem]">
              Vì sao nên chọn {SHOP_BRAND}?
            </h1>
          </div>

          {/* Four illustrated benefits; preserve each image's full composition. */}
          <div className="order-2 grid gap-x-6 gap-y-7 py-6 sm:grid-cols-2 lg:flex-1 lg:content-center lg:grid-cols-4">
            {WHY_CARDS.map(({ title, desc, image, icon: Icon }) => (
              <article
                key={title}
                className="mx-auto flex w-full max-w-72 flex-col lg:max-w-[clamp(12rem,26svh,16rem)]"
              >
                <div className="mb-4 aspect-square w-full overflow-hidden rounded-2xl bg-[#f7f1e3] ring-1 ring-[var(--aloha-line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={title}
                    width={1024}
                    height={1024}
                    loading="lazy"
                    decoding="async"
                    className="block h-full w-full object-contain"
                  />
                </div>
                <div className="flex min-h-14 items-start gap-2.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                    <Icon size={20} strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-6 tracking-normal text-stone-800 sm:text-lg sm:leading-7">
                      {title}
                    </h2>
                  </div>
                </div>
                <p className="mt-2 text-base leading-7 text-stone-600">
                  {desc}
                </p>
              </article>
            ))}
          </div>

          <div className="order-3 mt-auto flex shrink-0 flex-col items-center gap-2 pt-2">
            <Link
              href="/tim"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--aloha-green-dark)] px-8 text-base font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)]"
            >
              Khám phá sản phẩm →
            </Link>
          </div>
        </div>
      </section>
      <CustomerReviews reviews={CUSTOMER_REVIEWS_SEED} demo />
    </div>
  );
}
