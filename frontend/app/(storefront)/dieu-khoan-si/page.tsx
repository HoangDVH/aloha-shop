"use client";
import Link from "next/link";
import { useWholesalePolicy, defaultWholesalePolicy } from "@/lib/wholesalePolicy";
import { formatVnd } from "@/lib/api";
export default function Page() {
  const query = useWholesalePolicy();
  const policy = query.data || defaultWholesalePolicy;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-slate-700">
    <Link href="/dang-ky-si" className="text-[var(--aloha-green)]">← Đăng ký khách sỉ</Link>
    <h1 className="text-3xl font-bold">Điều khoản mua sỉ Aloha</h1>
    <p>Chính sách mua sỉ hiện hành</p>
    <h2 className="text-xl font-semibold">Hồ sơ và giá sỉ</h2>
    <p>Aloha đối chiếu thông tin cửa hàng và xác minh người đại diện trước khi mở quyền mua sỉ. Giá sỉ chỉ áp dụng sau khi được duyệt; sản phẩm chưa có giá cần liên hệ báo giá.</p>
    <p>Sỉ HCM: đơn đầu từ {formatVnd(policy.hcmFirstMinimum)} tiền hàng theo giá sỉ; từ lần sau không giới hạn mức tiền và số lượng. Đã mua được xác định bằng đơn hoàn tất trên shop hoặc hóa đơn KiotViet hợp lệ. Khách tự bố trí xe nhận hàng tại cửa hàng hoặc TP.HCM.</p>
    <p>Sỉ tỉnh: mỗi đơn từ {formatVnd(policy.tinhMinimum)} tiền hàng theo giá sỉ, chưa gồm vận chuyển. Cây thành phẩm tối thiểu {policy.finishedQuantity} chậu/mẫu; cây thô tối thiểu {policy.rawQuantity} cây/mẫu; chậu/tiểu cảnh có giá sỉ dưới {formatVnd(policy.cheapPotPrice)} tối thiểu {policy.cheapPotQuantity} sản phẩm/mẫu. Mỗi mã hàng là một mẫu, màu/kích thước khác mã tính riêng.</p>
    <p>Không áp dụng ngoại lệ mua nguyên thùng. Không cộng ưu đãi bán lẻ vào giá sỉ. Thay đổi địa chỉ giao không tự thay đổi nhóm khách.</p>
    <h2 className="text-xl font-semibold">Đặt trước và giao hàng</h2>
    <p>Khi hàng hết hoặc lượng đặt vượt số có sẵn, Aloha kiểm tra và liên hệ xác nhận trước khi hướng dẫn thanh toán trước hoặc đặt cọc. Thời gian, phí giao và điều kiện thanh toán được xác nhận với khách trước khi tiến hành.</p>
    <h2 className="text-xl font-semibold">Thông tin đăng ký</h2>
    <p>Thông tin liên hệ và hồ sơ kinh doanh được sử dụng để xét duyệt, đối chiếu hồ sơ khách hàng và hỗ trợ đơn hàng. Bạn có thể liên hệ Aloha để yêu cầu cập nhật thông tin của mình.</p>
  </main>;
}
