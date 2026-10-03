import Link from "next/link";
import type { CampaignUI } from "@/lib/campaign/campaignApi";

function vnDate(iso: string) {
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ngày ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}

/** Không có chiến dịch đang chạy: báo đã kết thúc / tạm dừng và giới thiệu chương trình sắp tới nếu có. */
export function DealsEmpty({ paused, upcoming }: { paused: boolean; upcoming: CampaignUI | null }) {
  return (
    <section className="rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-black/[0.04]">
      <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
        {paused ? "Chương trình đang tạm dừng" : "Chương trình ưu đãi đã kết thúc"}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {paused
          ? "Cửa hàng đang cập nhật chương trình, bạn quay lại sau ít phút nhé."
          : "Cảm ơn bạn đã quan tâm. Theo dõi cửa hàng để không bỏ lỡ đợt ưu đãi tiếp theo."}
      </p>
      {upcoming ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl bg-[#FFF3E6] px-4 py-3 text-sm">
          <p className="font-bold text-[#C8102E]">Sắp diễn ra: {upcoming.name}</p>
          <p className="mt-0.5 text-slate-600">Bắt đầu lúc {vnDate(upcoming.startAt)}</p>
        </div>
      ) : null}
      <Link href="/" className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-[#C8102E] px-6 text-sm font-bold text-white">
        Tiếp tục mua sắm
      </Link>
    </section>
  );
}
