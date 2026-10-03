import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  XCircle,
} from "lucide-react";
import type { ShopOrder } from "@/lib/orders";

export type HeroTone = "ok" | "wait" | "done" | "bad";

export function waitingStaff(o: ShopOrder) {
  return (
    Boolean(o.customerReportedPaidAt) ||
    o.paymentStatus === "processing" ||
    o.statusValue === "Chờ shop xác nhận CK"
  );
}

export function heroFor(o: ShopOrder): {
  Icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
  tone: HeroTone;
} {
  const ps = o.paymentStatus || "";
  if (o.orderStatus === "cho_xac_nhan") {
    return {
      Icon: Clock,
      title: "Aloha đã nhận đơn",
      subtitle:
        "Aloha đang chuẩn bị cây và sẽ gửi ảnh chụp thực tế qua Zalo/SĐT để bạn duyệt trước khi đóng gói & gửi hàng.",
      tone: "wait",
    };
  }
  if (ps === "paid") {
    return {
      Icon: CheckCircle2,
      title: "Cảm ơn bạn đã mua hàng!",
      subtitle:
        "Cửa hàng đã xác nhận thanh toán thành công. Đơn đang được chuẩn bị giao.",
      tone: "done",
    };
  }
  if (ps === "cancelled") {
    return {
      Icon: XCircle,
      title: "Đơn đã hủy",
      subtitle: "Đơn này không còn hiệu lực.",
      tone: "bad",
    };
  }
  if (ps === "underpaid") {
    return {
      Icon: AlertCircle,
      title: "Thanh toán chưa đủ / cần kiểm tra",
      subtitle:
        "Hệ thống đã nhận được chuyển khoản nhưng số tiền chưa khớp. Shop đang kiểm tra — giữ trang này hoặc liên hệ cửa hàng.",
      tone: "wait",
    };
  }
  if (ps === "expired") {
    return {
      Icon: AlertCircle,
      title: "Hết hạn chuyển khoản",
      subtitle:
        "Thời gian thanh toán đã hết. Bấm «Tạo mã QR mới» để thanh toán tiếp (không cần đặt lại đơn).",
      tone: "bad",
    };
  }
  if (ps === "failed") {
    return {
      Icon: AlertCircle,
      title: "Xác nhận thanh toán lỗi",
      subtitle: "Liên hệ shop để được hỗ trợ.",
      tone: "bad",
    };
  }
  if (ps === "cod") {
    return {
      Icon: Package,
      title: "Đặt hàng thành công",
      subtitle:
        "Thanh toán khi nhận hàng. Nhân viên sẽ liên hệ / xử lý đơn sớm.",
      tone: "ok",
    };
  }
  if (waitingStaff(o)) {
    return {
      Icon: Clock,
      title: "Đang chờ xác nhận thanh toán",
      subtitle:
        "Bạn đã báo đã chuyển khoản. Hệ thống đang đối chiếu (hoặc nhân viên kiểm tra) — giữ trang này, sẽ tự cập nhật khi xong.",
      tone: "wait",
    };
  }
  if (ps === "unpaid") {
    return {
      Icon: Clock,
      title: "Đơn đã ghi nhận — chờ chuyển khoản",
      subtitle:
        "Chuyển đúng số tiền + nội dung bên dưới. Tiền vào sẽ tự xác nhận; hoặc bấm “Tôi đã chuyển khoản” rồi giữ trang để nhận kết quả.",
      tone: "wait",
    };
  }
  return {
    Icon: CheckCircle2,
    title: "Đặt hàng thành công",
    subtitle: "Cảm ơn bạn. Đơn đang được xử lý.",
    tone: "ok",
  };
}
