import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";

/** Ảnh nhỏ bên dưới banner — lấy từ ảnh feature sẵn có */
const FEATURE_CARDS = [
  {
    title: "Chất lượng chọn lọc",
    src: "/banners/feature-chat-luong.png",
    href: "/tim?q=cay",
    blurb: "Cây khỏe, chậu đẹp — kiểm tra trước khi giao.",
  },
  {
    title: "Đa dạng mẫu mã",
    src: "/banners/feature-da-dang.png",
    href: "/tim?q=chau",
    blurb: "Nhiều mẫu chậu, cây & phụ kiện — phối theo không gian.",
  },
  {
    title: "Giá tốt · hỗ trợ nhanh",
    src: "/banners/feature-gia-tot.png",
    href: "https://zalo.me/0794901233",
    external: true,
    blurb: "Giá cạnh tranh · giao toàn quốc · tư vấn sau bán.",
  },
];

export function WhyAloha() {
  return (
    <section className="bg-[var(--aloha-cream)] py-5 sm:py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-4 sm:mb-6">
          <SectionTitle>Vì sao chọn ALOHA</SectionTitle>
          <p className="mt-2 text-center text-sm text-[var(--aloha-muted)]">
            Tin cậy · dễ mua · phù hợp không gian xanh của bạn
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {FEATURE_CARDS.map((c) => {
            const inner = (
              <>
                <div className="aspect-[16/9] overflow-hidden bg-[var(--aloha-green-light)] sm:aspect-[2/1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.src}
                    alt={c.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-1 p-3.5 sm:p-4">
                  <h3 className="text-sm font-bold text-[var(--aloha-green)]">{c.title}</h3>
                  <p className="text-[13px] leading-relaxed text-[var(--aloha-muted)]">{c.blurb}</p>
                </div>
              </>
            );

            const className =
              "group overflow-hidden rounded-[var(--aloha-radius)] bg-white shadow-[var(--aloha-shadow)] ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-[var(--aloha-shadow-lg)]";

            return c.external ? (
              <a
                key={c.title}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                {inner}
              </a>
            ) : (
              <Link key={c.title} href={c.href} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
