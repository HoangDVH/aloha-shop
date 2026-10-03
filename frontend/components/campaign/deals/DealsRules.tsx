import type { CampaignUI } from "@/lib/campaign/campaignApi";

function vnDateTime(iso: string) {
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function DealsRules({ campaign }: { campaign: CampaignUI }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-black/[0.04]">
      <h2 className="mb-3 text-lg font-black text-slate-900">Thể lệ chương trình</h2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          Thời gian: từ {vnDateTime(campaign.startAt)} đến {vnDateTime(campaign.endAt)} (giờ Việt Nam).
        </li>
        <li>Ưu đãi dành cho khách lẻ mua trên web. Tài khoản khách sỉ, cộng tác viên hoặc tài khoản đang bị khoá không áp dụng.</li>
        <li>Voucher cần bấm “Lưu” trước khi dùng. Mỗi voucher có số lượt giới hạn, hết lượt thì dừng.</li>
        <li>Mỗi đơn dùng tối đa 1 voucher giảm giá hàng và 1 voucher hỗ trợ ship, trừ khi voucher ghi không dùng chung.</li>
        <li>Giá flash sale chỉ áp dụng trong khung giờ và trong số suất còn lại. Hết suất, sản phẩm về giá thường.</li>
        <li>Quà tặng 0đ đi kèm đơn đủ điều kiện, hết quà thì dừng tặng. Khi trả hàng, vui lòng hoàn trả kèm quà.</li>
        <li>Nếu giá hiển thị sai do lỗi hệ thống, cửa hàng có quyền liên hệ huỷ đơn và hoàn tiền đầy đủ.</li>
      </ul>
    </div>
  );
}
