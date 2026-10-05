import Link from "next/link";
import type { Metadata } from "next";
import { fetchRecruitmentFormOptions } from "@/lib/recruitmentApi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thông báo xử lý dữ liệu tuyển dụng",
  description: "Cách Aloha thu thập, sử dụng và lưu trữ thông tin ứng viên.",
};

export default async function RecruitmentPrivacyPage() {
  const options = await fetchRecruitmentFormOptions();
  const days = options?.retentionDays;

  return (
    <div className="bg-[#F7F7F4] py-8">
      <article className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-6 text-[15px] leading-relaxed text-slate-700 ring-1 ring-[var(--aloha-line)] sm:p-8">
        <header>
          <h1 className="text-2xl font-extrabold text-[var(--aloha-green-dark)]">
            Thông báo xử lý dữ liệu tuyển dụng
          </h1>
          {options?.noticeVersion ? (
            <p className="mt-1 text-xs text-slate-500">Phiên bản: {options.noticeVersion}</p>
          ) : null}
        </header>

        <section>
          <h2 className="font-bold text-slate-900">1. Thông tin Aloha thu thập</h2>
          <p>
            Họ tên, email, số điện thoại, nơi làm việc mong muốn, vị trí quan tâm, mức kinh nghiệm, mô tả kinh
            nghiệm và CV (nếu bạn đính kèm). Aloha không yêu cầu CCCD, tài khoản ngân hàng hay thông tin không
            cần cho tuyển dụng.
          </p>
          <p className="mt-2">
            Nếu bạn đang đăng nhập tài khoản mua hàng Aloha khi gửi, hồ sơ được ghi kèm mã tài khoản đó để bộ phận
            tuyển dụng nhận biết. Hồ sơ, CV và ghi chú tuyển dụng không hiển thị trong tài khoản mua hàng và không
            dùng cho mục đích bán hàng. Bạn không cần đăng nhập để ứng tuyển.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">2. Mục đích sử dụng</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Ứng tuyển một vị trí:</strong> xem xét hồ sơ, liên hệ phỏng vấn và trao đổi về vị trí đó.
            </li>
            <li>
              <strong>Để lại thông tin liên hệ:</strong> liên hệ khi Aloha có công việc phù hợp với thông tin bạn
              cung cấp.
            </li>
          </ul>
          <p className="mt-2">Thông tin chỉ dùng cho tuyển dụng, không dùng cho quảng cáo hay tiếp thị.</p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">3. Ai được xem</h2>
          <p>
            Chỉ nhân sự Aloha được giao phụ trách tuyển dụng. CV được lưu riêng tư, không công khai trên website.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">4. Thời gian lưu</h2>
          <p>
            {days
              ? `Hồ sơ và CV được lưu tối đa ${days} ngày kể từ ngày gửi theo chính sách hiện hành của Aloha, sau đó tự động xóa.`
              : "Thời hạn lưu theo chính sách hiện hành của Aloha; hồ sơ được xóa khi hết hạn."}
          </p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">5. Rút hồ sơ hoặc yêu cầu xóa dữ liệu</h2>
          <p>
            Trả lời email xác nhận Aloha đã gửi, hoặc liên hệ qua số điện thoại / email chính thức ở cuối trang
            kèm mã biên nhận. Aloha xác minh thông tin liên hệ trước khi xử lý.
          </p>
        </section>

        <p>
          <Link href="/tuyen-dung" className="font-bold text-[var(--aloha-green-dark)] underline">
            ← Quay lại trang tuyển dụng
          </Link>
        </p>
      </article>
    </div>
  );
}
