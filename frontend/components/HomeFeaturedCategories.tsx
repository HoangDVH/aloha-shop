import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import { categoryHref } from "@/lib/api";

/** 6 danh mục nổi bật — link /danh-muc khớp navbar (không dùng ?q= tìm kiếm). */
export const HOME_FEATURED_CATEGORIES = [
  {
    label: "Cây cảnh",
    href: categoryHref({
      id: 228801,
      name: "CÂY CẢNH ĐỦ LOẠI",
      slug: "cay-canh-du-loai",
    }),
    image: "/categories/cat-cay-canh.png?v=1",
  },
  {
    label: "Chậu cây",
    href: categoryHref({
      id: 229259,
      name: "CHẬU TRỒNG CÂY",
      slug: "chau-trong-cay",
    }),
    image: "/categories/cat-chau-cay.png?v=1",
  },
  {
    label: "Bình hoa",
    href: categoryHref({
      id: 749681,
      name: "BÌNH CẮM HOA",
      slug: "binh-cam-hoa",
    }),
    image: "/categories/cat-binh-hoa.png?v=1",
  },
  {
    label: "Giá thể",
    href: categoryHref({
      id: 745019,
      name: "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY",
      slug: "dat-da-gia-the-dinh-duong-trong-cay",
    }),
    image: "/categories/cat-gia-the.png?v=1",
  },
  {
    label: "Hạt giống",
    href: categoryHref({
      id: 300707,
      name: "HẠT GIỐNG",
      slug: "hat-giong",
    }),
    image: "/categories/cat-hat-giong.png?v=1",
  },
  {
    label: "Phụ kiện",
    href: categoryHref({
      id: 729790,
      name: "PHỤ KIỆN TRANG TRÍ",
      slug: "phu-kien-trang-tri",
    }),
    image: "/categories/cat-phu-kien.png?v=1",
  },
] as const;

export function HomeFeaturedCategories() {
  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative mb-8 sm:mb-10">
          <SectionTitle>DANH MỤC NỔI BẬT</SectionTitle>
          <div className="mt-2 flex justify-end sm:absolute sm:right-0 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2">
            <Link
              href="/tim"
              className="text-sm font-semibold text-[var(--aloha-green)] transition hover:text-[var(--aloha-green-dark)]"
            >
              Xem tất cả →
            </Link>
          </div>
        </div>

        <ul className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-6 sm:mt-4 sm:gap-x-0 sm:justify-between">
          {HOME_FEATURED_CATEGORIES.map((c, i) => (
            <li
              key={c.label}
              className={`flex min-w-[5.5rem] flex-1 basis-[30%] justify-center sm:basis-0 sm:px-2 md:px-3 ${
                i < HOME_FEATURED_CATEGORIES.length - 1
                  ? "sm:border-r sm:border-[var(--aloha-line)]"
                  : ""
              }`}
            >
              <Link
                href={c.href}
                className="group flex w-full max-w-[8.5rem] flex-col items-center gap-2.5 text-center"
              >
                <span className="relative block aspect-square w-full max-w-[7.25rem] overflow-hidden rounded-full bg-[var(--aloha-surface)] ring-1 ring-[var(--aloha-line)] transition group-hover:ring-[var(--aloha-green)]/35 group-hover:shadow-[var(--aloha-shadow)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt={c.label}
                    className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.05]"
                    loading="lazy"
                  />
                </span>
                <span className="text-sm font-semibold text-[var(--aloha-ink)] group-hover:text-[var(--aloha-green-dark)]">
                  {c.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
