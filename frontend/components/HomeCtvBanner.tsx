import Link from "next/link";

/**
 * Banner CTV — ảnh 2000×667 (chuẩn tỉ lệ 3:1), hiện full không crop.
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
            src="/banners/banner-ctv-aloha.png?v=17"
            alt="Cộng tác viên Aloha — Trở thành CTV Aloha, kiếm thêm thu nhập cùng Aloha"
            className="home-ctv-banner__img pointer-events-none block h-full w-full select-none"
            draggable={false}
          />

          <Link
            href="/tuyen-ctv"
            className="absolute z-10 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            style={{
              left: "7.55%",
              top: "77.21%",
              width: "25.65%",
              height: "13.19%",
            }}
          >
            <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
              Đăng ký ngay
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
