import Link from "next/link";

/**
 * Banner CTV — ảnh user, tỉ lệ 1024×256 (~2/3 cao gốc), hiện full không crop.
 * 2 vùng bấm HTML đè đúng nút trong ảnh.
 */
export function HomeCtvBanner() {
  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="home-ctv-banner relative overflow-hidden rounded-[var(--aloha-radius-lg)] shadow-[var(--aloha-shadow)] ring-1 ring-[var(--aloha-line)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/banners/banner-ctv-aloha.png?v=11"
            alt="Trở thành CTV Aloha — kiếm thêm thu nhập cùng Aloha"
            className="home-ctv-banner__img block h-full w-full select-none"
            draggable={false}
          />

          <Link
            href="/dang-ky"
            className="absolute z-10 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            style={{
              left: "9.18%",
              top: "75.00%",
              width: "19.34%",
              height: "12.11%",
            }}
          >
            <span className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
              Đăng ký ngay
            </span>
          </Link>

          <Link
            href="/bai-viet"
            className="absolute z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]"
            style={{
              left: "30.57%",
              top: "78.91%",
              width: "15.14%",
              height: "4.69%",
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
