import Link from "next/link";

/**
 * Banner CTV — ảnh 2170×725 (~3:1), chuẩn tỉ lệ hero, hiện full không crop.
 * Cả banner dẫn tới /tuyen-ctv.
 */
export function HomeCtvBanner() {
  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="home-ctv-banner relative overflow-hidden rounded-[var(--aloha-radius-lg)] shadow-[var(--aloha-shadow)] ring-1 ring-[var(--aloha-line)]">
          <Link
            href="/tuyen-ctv"
            className="absolute inset-0 z-[5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            aria-label="Cộng tác viên Aloha — xem trang tuyển CTV"
          />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/banners/banner-ctv-aloha.png?v=15"
            alt="Cộng tác viên Aloha — Chia sẻ cây xanh, nhận hoa hồng"
            className="home-ctv-banner__img pointer-events-none block h-full w-full select-none"
            draggable={false}
          />

          <Link
            href="/tuyen-ctv"
            className="absolute z-10 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            style={{
              left: "24.75%",
              top: "79.86%",
              width: "14.98%",
              height: "10.62%",
            }}
          >
            <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
              Đăng ký ngay
            </span>
          </Link>

          <Link
            href="/tuyen-ctv#cach-hoat-dong"
            className="absolute z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            style={{
              left: "41.47%",
              top: "83.72%",
              width: "11.43%",
              height: "2.34%",
            }}
          >
            <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
              Tìm hiểu cách hoạt động
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
