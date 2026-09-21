"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SHOP_BRAND } from "@/lib/brand";

export const CTV_TERMS_VERSION = "1.0";

/** Nội dung điều khoản — dùng chung form + section landing. */
export function CtvTermsBody() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-600">
      <p>
        Khi đăng ký làm cộng tác viên (CTV) của {SHOP_BRAND}, bạn xác nhận đã đọc, hiểu và đồng ý
        tuân thủ toàn bộ điều khoản dưới đây. Điều khoản có hiệu lực kể từ khi bạn bấm «Tôi đã
        hiểu» và gửi hồ sơ đăng ký.
      </p>

      <div>
        <h4 className="font-bold text-slate-800">1. Điều kiện tham gia</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Đủ 18 tuổi, cung cấp thông tin trung thực (họ tên, SĐT, Zalo, địa chỉ, kênh bán).</li>
          <li>Có kênh bán / chia sẻ hợp pháp (Facebook, TikTok, Zalo, website…).</li>
          <li>
            Hồ sơ chỉ được kích hoạt sau khi Aloha duyệt; Aloha có quyền từ chối mà không cần nêu lý
            do chi tiết.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-slate-800">2. Vai trò & nghĩa vụ CTV</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Chỉ dùng link / mã giới thiệu được cấp để chia sẻ sản phẩm chính thức của Aloha.</li>
          <li>
            Không được tự ý thay đổi giá, chính sách đổi trả, hoặc cam kết vượt thẩm quyền cửa hàng.
          </li>
          <li>Không đăng nội dung sai sự thật, xúc phạm, hoặc làm ảnh hưởng uy tín thương hiệu.</li>
          <li>Tuân thủ hướng dẫn bán hàng, hình ảnh và nội dung mẫu do Aloha cung cấp (nếu có).</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-slate-800">3. Hoa hồng & thanh toán</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Hoa hồng chỉ tính trên đơn hợp lệ theo chính sách Aloha (đã giao / đủ điều kiện chi).</li>
          <li>
            Đơn hủy, hoàn, gian lận hoặc không đủ điều kiện sẽ không được tính / bị thu hồi hoa hồng.
          </li>
          <li>Thanh toán theo kỳ và theo thông tin tài khoản ngân hàng CTV đã khai báo.</li>
          <li>
            Mức hoa hồng có thể thay đổi theo sản phẩm / chương trình; Aloha thông báo trên cổng CTV.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-slate-800">4. Cấm gian lận</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>
            Cấm tự mua để hưởng hoa hồng, tạo đơn ảo, dùng SĐT / tài khoản giả, hoặc thao túng hệ
            thống.
          </li>
          <li>Cấm spam, quấy rối khách hàng, hoặc dùng công cụ bot trái phép.</li>
          <li>
            Vi phạm có thể dẫn tới hủy hoa hồng, khóa tài khoản CTV và từ chối thanh toán các khoản
            liên quan.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-slate-800">5. Bảo mật & dữ liệu</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Bạn chịu trách nhiệm bảo mật tài khoản đăng nhập và link giới thiệu của mình.</li>
          <li>Không chia sẻ dữ liệu khách hàng / đơn hàng cho bên thứ ba khi chưa được phép.</li>
          <li>
            Aloha xử lý dữ liệu hồ sơ CTV nhằm xét duyệt, vận hành chương trình và thanh toán hoa
            hồng.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-slate-800">6. Tạm dừng / chấm dứt</h4>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>Aloha có quyền tạm dừng hoặc chấm dứt tư cách CTV nếu phát hiện vi phạm điều khoản.</li>
          <li>
            Bạn có thể ngừng hợp tác bằng cách liên hệ Aloha; hoa hồng đủ điều kiện vẫn được xử lý
            theo kỳ.
          </li>
          <li>Aloha có thể cập nhật điều khoản; phiên bản mới sẽ được công bố trên trang tuyển CTV.</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-slate-800">7. Liên hệ hỗ trợ</h4>
        <p className="mt-1.5">
          Zalo Aloha:{" "}
          <a
            href="https://zalo.me/0794901233"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--aloha-green)] hover:underline"
          >
            zalo.me/0794901233
          </a>
          . Mọi thắc mắc về hoa hồng, đơn hàng hoặc tài khoản CTV vui lòng liên hệ kênh hỗ trợ chính
          thức.
        </p>
      </div>

      <p className="text-xs text-slate-400">
        Phiên bản điều khoản {CTV_TERMS_VERSION} · {SHOP_BRAND}
      </p>
    </div>
  );
}

type Props = {
  agreed: boolean;
  onAgreed: () => void;
  error?: string;
};

/**
 * Điều khoản luôn hiện trong form: kéo hết → bật «Tôi đã hiểu».
 */
export function CtvTermsAccept({ agreed, onAgreed, error }: Props) {
  const [readAll, setReadAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agreed) {
      setReadAll(true);
      return;
    }
    setReadAll(false);
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      if (el.scrollHeight <= el.clientHeight + 4) {
        setReadAll(true);
        return;
      }
      const atBottom =
        Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 12;
      if (atBottom) setReadAll(true);
    };

    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    const t = window.setTimeout(check, 80);
    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
      window.clearTimeout(t);
    };
  }, [agreed]);

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-xl bg-white ring-1 ring-[var(--aloha-line)]"
        role="region"
        aria-labelledby="ctv-terms-title"
      >
        <div className="border-b border-[var(--aloha-line)] px-3 py-2.5">
          <p id="ctv-terms-title" className="text-sm font-bold text-slate-800">
            Điều khoản cộng tác viên
          </p>
          <p className="text-[11px] text-slate-400">
            {agreed
              ? "Bạn đã xác nhận điều khoản"
              : "Kéo đọc hết nội dung bên dưới, rồi bấm «Tôi đã hiểu»"}
          </p>
        </div>

        <div
          ref={scrollRef}
          tabIndex={0}
          className="max-h-[min(48svh,320px)] overflow-y-auto overscroll-contain px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--aloha-green)]/40"
          aria-label="Nội dung điều khoản cộng tác viên"
        >
          <CtvTermsBody />
          <p className="mt-4 border-t border-dashed border-slate-200 pt-3 text-center text-[11px] font-semibold text-slate-400">
            — Hết điều khoản —
          </p>
        </div>

        <div className="space-y-2 border-t border-[var(--aloha-line)] bg-[#FDFBF7] px-3 py-3">
          {agreed ? (
            <p className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--aloha-green-light)] py-2.5 text-sm font-bold text-[var(--aloha-green-dark)]">
              <CheckCircle2 size={18} aria-hidden />
              Đã hiểu điều khoản
            </p>
          ) : (
            <>
              {!readAll ? (
                <p className="text-center text-[11px] font-medium text-amber-700">
                  Vui lòng kéo đọc hết nội dung ở trên
                </p>
              ) : (
                <p className="text-center text-[11px] font-medium text-[var(--aloha-green-dark)]">
                  Bạn đã xem hết — bấm xác nhận bên dưới
                </p>
              )}
              <button
                type="button"
                disabled={!readAll}
                onClick={onAgreed}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--aloha-green-dark)] text-sm font-bold text-white transition hover:bg-[var(--aloha-green)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                Tôi đã hiểu
              </button>
            </>
          )}
        </div>
      </div>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
