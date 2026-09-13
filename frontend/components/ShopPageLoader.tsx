"use client";

const LOGO_SRC = "/brand/logo-icon-auth.png?v=1";

type Props = {
  /** fixed che cả màn (mặc định) — false: chỉ chiếm khung cha */
  fullscreen?: boolean;
};

/** Overlay loading kiểu KiotViet — logo nhỏ + vòng quay mảnh, không chữ. */
export function ShopPageLoader({ fullscreen = true }: Props) {
  return (
    <div
      className={
        fullscreen
          ? "shop-page-loader fixed inset-0 z-[200] flex items-center justify-center"
          : "shop-page-loader relative flex min-h-[40vh] w-full items-center justify-center"
      }
      role="status"
      aria-live="polite"
      aria-label="Đang xử lý"
      aria-busy="true"
    >
      <div className="shop-loader-wrap" aria-hidden>
        <div className="shop-loader-ring" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="" className="shop-loader-logo" draggable={false} />
      </div>
    </div>
  );
}
