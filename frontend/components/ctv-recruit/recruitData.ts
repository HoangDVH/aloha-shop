import {
  BadgePercent,
  Boxes,
  Gift,
  Headphones,
  Link2,
  Package,
  Percent,
  Share2,
  Sparkles,
  Sprout,
  Users,
  Wallet,
} from "lucide-react";
import type {
  CtvRecruitGuestInput,
  CtvRecruitLoggedInInput,
} from "@/lib/ctvRecruitSchema";

export type CtvFormValues = CtvRecruitGuestInput | CtvRecruitLoggedInInput;

export const QUICK_BENEFITS = [
  { icon: Percent, title: "Hoa hồng từ 10% - 15%" },
  { icon: Boxes, title: "4.000+ sản phẩm" },
  { icon: Sparkles, title: "Công cụ bán sẵn" },
  { icon: Wallet, title: "Thanh toán nhanh" },
];

export const WHY_CARDS = [
  {
    icon: BadgePercent,
    title: "Hoa hồng hấp dẫn",
    desc: "Mức hoa hồng cạnh tranh theo từng sản phẩm, càng bán nhiều càng nhận nhiều.",
  },
  {
    icon: Package,
    title: "Sản phẩm chất lượng",
    desc: "Kho chậu & cây chọn lọc, hình ảnh thật — dễ chia sẻ, dễ chốt đơn.",
  },
  {
    icon: Share2,
    title: "Hỗ trợ toàn diện",
    desc: "Có link giới thiệu, ảnh mẫu, nội dung bán hàng sẵn để đăng ngay.",
  },
  {
    icon: Headphones,
    title: "Đội ngũ hỗ trợ",
    desc: "Tư vấn Zalo / hotline khi cần — không để bạn bán một mình.",
  },
  {
    icon: Sprout,
    title: "Phát triển lâu dài",
    desc: "Xây dựng thu nhập thụ động từ đam mê cây xanh cùng Aloha.",
  },
];

export const STEPS = [
  {
    n: 1,
    icon: Users,
    title: "Đăng ký tài khoản",
    desc: "Bấm Đăng ký ngay — điền form và chờ Aloha duyệt CTV.",
  },
  {
    n: 2,
    icon: Link2,
    title: "Nhận link & sản phẩm",
    desc: "Vào cổng CTV lấy link, ảnh và mã giới thiệu.",
  },
  {
    n: 3,
    icon: Gift,
    title: "Chia sẻ & kiếm hoa hồng",
    desc: "Đăng bán trên mạng xã hội — nhận hoa hồng khi đơn thành công.",
  },
];
