import Link from "next/link";
export default function Page() {
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-slate-700">
    <Link href="/dang-ky-si" className="text-[var(--aloha-green)]">← Đăng ký khách sỉ</Link>
    <h1 className="text-3xl font-bold">Điều khoản mua sỉ Aloha</h1>
    <p>Phiên bản 23/09/2026</p>
    <h2 className="text-xl font-semibold">Hồ sơ và giá sỉ</h2>
    <p>Aloha đối chiếu thông tin cửa hàng và xác minh người đại diện trước khi mở quyền mua sỉ. Giá sỉ chỉ áp dụng sau khi được duyệt; sản phẩm chưa có giá cần liên hệ báo giá.</p>
    <p>Khách thuộc nhóm TỈNH cần đơn từ 2.000.000đ tiền hàng theo giá sỉ, chưa gồm vận chuyển. Không cộng ưu đãi bán lẻ vào giá sỉ. Thay đổi địa chỉ giao không tự thay đổi nhóm khách.</p>
    <h2 className="text-xl font-semibold">Đặt trước và giao hàng</h2>
    <p>Khi hàng hết hoặc lượng đặt vượt số có sẵn, Aloha kiểm tra và liên hệ xác nhận trước khi hướng dẫn thanh toán trước hoặc đặt cọc. Thời gian, phí giao và điều kiện thanh toán được xác nhận với khách trước khi tiến hành.</p>
    <h2 className="text-xl font-semibold">Thông tin đăng ký</h2>
    <p>Thông tin liên hệ và hồ sơ kinh doanh được sử dụng để xét duyệt, đối chiếu hồ sơ khách hàng và hỗ trợ đơn hàng. Bạn có thể liên hệ Aloha để yêu cầu cập nhật thông tin của mình.</p>
  </main>;
}
