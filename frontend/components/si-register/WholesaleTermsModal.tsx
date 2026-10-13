"use client";

import { useEffect } from "react";
import { X, Check, ShieldCheck, Sparkles } from "lucide-react";
import { defaultWholesalePolicy, useWholesalePolicy } from "@/lib/wholesalePolicy";
import { formatVnd } from "@/lib/api";

interface WholesaleTermsModalProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export function WholesaleTermsModal({
  open,
  onClose,
  onAccept,
}: WholesaleTermsModalProps) {
  const query = useWholesalePolicy();
  const policy = query.data || defaultWholesalePolicy;
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wholesale-terms-title"
    >
      {/* Nền đen mờ backdrop */}
      <button
        type="button"
        aria-label="Đóng cửa sổ điều khoản"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Khung nội dung chính Modal */}
      <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-[#FAF8F5] shadow-2xl border border-stone-200/90 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200/80 bg-white/95 px-5 py-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[#0f3822]">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3
                id="wholesale-terms-title"
                className="text-base sm:text-lg font-black tracking-tight text-[#0f3822]"
              >
                ĐIỀU KHOẢN MUA SỈ & CHÍNH SÁCH BẢO MẬT
              </h3>
              <p className="text-xs text-stone-500">
                Quy định áp dụng cho đại lý & khách sỉ Aloha
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nội dung cuộn chính: Hiển thị trọn vẹn thông tin như ảnh 2 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:py-6 space-y-5">
          {/* Banner thông báo bắt buộc */}
          <div className="overflow-hidden rounded-2xl bg-[#0f3822] p-4 text-center text-white shadow-sm sm:p-5">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              CHỈ ÁP DỤNG CHO KHÁCH MUA HÀNG ĐỂ KINH DOANH, BÁN LẠI
            </h4>
            <p className="mt-1 text-xs sm:text-sm font-medium text-emerald-100">
              Chính sách giá sỉ áp dụng theo khu vực và số lượng từng mẫu sản phẩm
            </p>
          </div>

          {/* Lưới 2 khối chính sách song song chuẩn theo Ảnh 2 */}
          <div className="grid gap-5 md:grid-cols-2 items-stretch">
            {/* KHỐI 01: MUA SỈ TẠI TP.HCM */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-sm">
              {/* Dải màu xanh lá bên trái */}
              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#2e7d32]" />
              <div>
                <div className="flex items-center gap-3 pb-3.5 border-b border-stone-100">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f5e9] text-sm sm:text-base font-black text-[#1b5e20] ring-4 ring-[#e8f5e9]/60">
                    01
                  </div>
                  <div>
                    <h5 className="text-base sm:text-lg font-black uppercase tracking-wide text-[#0f3822]">
                      MUA SỈ TẠI TP.HCM
                    </h5>
                    <p className="text-xs text-stone-500">Nội thành & khu vực lân cận</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-stone-700">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>
                      Đơn hàng đầu tiên có giá trị từ{" "}
                      <strong className="font-extrabold text-[#0f3822]">{formatVnd(policy.hcmFirstMinimum)}</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Từ lần mua tiếp theo, lấy số lượng tùy nhu cầu.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Áp dụng khi mua tại cửa hàng hoặc nhận tại TP.HCM.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Khách có thể đến lấy, bố trí xe nhận hàng hoặc chọn giao hàng tận nơi khi đặt trên shop.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>
                      Vui lòng đặt trước vài tiếng để ALOHA chuẩn bị, tránh chờ đợi hoặc kẹt đơn.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* KHỐI 02: ĐƠN SỈ GIAO ĐI TỈNH */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-sm">
              {/* Dải màu vàng đất/hổ phách bên trái */}
              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#d49926]" />
              <div>
                <div className="flex items-center gap-3 pb-3.5 border-b border-stone-100">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-[#fef7e0] text-sm sm:text-base font-black text-[#b38600] ring-4 ring-[#fef7e0]/60">
                    02
                  </div>
                  <div>
                    <h5 className="text-base sm:text-lg font-black uppercase tracking-wide text-[#0f3822]">
                      ĐƠN SỈ GIAO ĐI TỈNH
                    </h5>
                    <p className="text-xs text-stone-500">Đóng kiện gửi chành xe</p>
                  </div>
                </div>

                <p className="mt-3 text-xs italic text-stone-500 sm:text-sm">
                  Hàng cần kiểm tra và đóng gói kỹ nên thời gian chuẩn bị lâu hơn.
                </p>

                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-stone-700">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d49926]" />
                    <span>
                      Mỗi đơn tối thiểu{" "}
                      <strong className="font-extrabold text-[#0f3822]">{formatVnd(policy.tinhMinimum)}</strong> tiền hàng theo giá sỉ.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d49926]" />
                    <span>Áp dụng số lượng tối thiểu cho từng mẫu bên dưới.</span>
                  </li>
                </ul>

                {/* 3 highlight boxes theo từng dòng hàng */}
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border border-emerald-100/90 bg-[#eef6ed] p-2.5 sm:p-3">
                    <h6 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#1b5e20]">
                      CÂY THÀNH PHẨM
                    </h6>
                    <p className="mt-0.5 text-xs text-stone-700 sm:text-sm">
                      Mỗi mẫu lấy tối thiểu <strong className="font-extrabold text-[#0f3822]">{policy.finishedQuantity} chậu</strong>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100/90 bg-[#eef6ed] p-2.5 sm:p-3">
                    <h6 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#1b5e20]">
                      CHẬU HOẶC TIỂU CẢNH
                    </h6>
                    <p className="mt-0.5 text-xs text-stone-700 sm:text-sm">
                      Mẫu dưới <strong className="font-extrabold text-[#0f3822]">{formatVnd(policy.cheapPotPrice)}/sản phẩm</strong>: lấy tối thiểu{" "}
                      <strong className="font-extrabold text-[#0f3822]">{policy.cheapPotQuantity} sản phẩm</strong> cho mỗi mẫu.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100/90 bg-[#eef6ed] p-2.5 sm:p-3">
                    <h6 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#1b5e20]">
                      CÂY THÔ
                    </h6>
                    <p className="mt-0.5 text-xs text-stone-700 sm:text-sm">
                      Mỗi mẫu lấy tối thiểu <strong className="font-extrabold text-[#0f3822]">{policy.rawQuantity} cây</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Phần cam kết bảo mật thông tin */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-4 text-xs sm:text-sm text-stone-600 leading-relaxed">
            <h6 className="font-bold text-[#0f3822] mb-1">
              Chính sách bảo mật thông tin đại lý:
            </h6>
            <p>
              Aloha cam kết bảo mật toàn bộ thông tin đăng ký (số điện thoại, địa chỉ kho/cửa hàng, mã số thuế) của bạn. Dữ liệu chỉ được sử dụng cho mục đích xác thực hồ sơ đối tác sỉ, kích hoạt bảng giá đại lý và đối chiếu giao nhận hàng hóa.
            </p>
          </div>
        </div>

        {/* Footer Modal với các nút hành động */}
        <div className="sticky bottom-0 z-20 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-stone-200/80 bg-white/95 px-5 py-3.5 sm:px-6 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-50 transition cursor-pointer"
          >
            Đóng
          </button>
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--aloha-green)] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[var(--aloha-green-dark)] transition cursor-pointer"
            >
              <Check size={16} />
              <span>Tôi đã hiểu & Đồng ý điều khoản</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
