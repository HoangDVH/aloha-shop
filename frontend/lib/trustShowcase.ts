export type TrustItem = {
  id: string;
  enabled: boolean;
  imageUrl: string;
  logoUrl?: string;
  title: string;
  caption?: string;
  kind?: "store" | "customer";
};

export type TrustMarketplace = {
  id: string;
  enabled: boolean;
  platform: "shopee" | "lazada" | "tiktok" | "khac";
  label: string;
  url: string;
  note?: string;
};

export type TrustSectionProps = {
  title?: string;
  subtitle?: string;
  clientsTitle?: string;
  clients?: TrustItem[];
  services?: TrustItem[];
  gallery?: TrustItem[];
  marketplaces?: TrustMarketplace[];
  cta?: { label: string; href: string };
};

export const DEFAULT_TRUST_PROPS: Required<TrustSectionProps> = {
  title: "Khách hàng tin chọn Aloha",
  subtitle: "Bằng chứng thật từ các đơn hàng quà tặng doanh nghiệp, dịch vụ trọn gói và không gian thực tế tại vườn.",
  clientsTitle: "Đơn hàng đã thực hiện",
  clients: [
    {
      id: "bidv",
      enabled: true,
      imageUrl: "/banners/trust/don-bidv.webp",
      title: "BIDV Chi nhánh Đông Sài Gòn",
      caption: "Chậu cây thiết kế theo màu thương hiệu, logo in sắc nét, giao hàng đúng hẹn và chất lượng rất tốt. Sẽ tiếp tục đặt hàng cho các dịp sắp tới.",
    },
    {
      id: "phan-vu",
      enabled: true,
      imageUrl: "/banners/trust/don-phan-vu.webp",
      title: "Tập đoàn Phan Vũ",
      caption: "Bộ quà tặng chậu cây & túi quà in logo đồng bộ «Phát triển bền vững». Đóng gói chỉn chu, bàn giao đúng tiến độ cho sự kiện của tập đoàn.",
    },
    {
      id: "eco-retreat",
      enabled: true,
      imageUrl: "/banners/trust/don-eco-retreat.webp",
      title: "Eco Retreat",
      caption: "Hàng chậu cảnh tròn in ấn logo thương hiệu cao cấp. Cây chuẩn khỏe, đồng đều kích thước, làm quà tặng sự kiện rất sang trọng.",
    },
    {
      id: "binh-duong",
      enabled: true,
      imageUrl: "/banners/trust/don-binh-duong.webp",
      title: "Tỉnh Đoàn – Hội Sinh viên Bình Dương",
      caption: "Chậu cây lưu niệm kỷ niệm 75 năm Ngày truyền thống HSSV. Thiết kế trang trọng, ý nghĩa, cán bộ đoàn và các bạn sinh viên rất ưng ý.",
    },
    {
      id: "tay-ninh",
      enabled: true,
      imageUrl: "/banners/trust/don-tay-ninh.webp",
      title: "Tỉnh Đoàn Tây Ninh",
      caption: "Chậu vuông in biểu trưng kỷ niệm phong trào thanh niên Việt Nam",
    },
    {
      id: "hoang-gia",
      enabled: true,
      imageUrl: "/banners/trust/don-hoang-gia.webp",
      title: "Gốm Sứ & Sen Đá Hoàng Gia",
      caption: "Chậu sen đá quà tặng in thương hiệu cao cấp",
    },
  ],
  services: [
    {
      id: "srv-logo",
      enabled: true,
      imageUrl: "/banners/trust/dich-vu-in-logo.webp",
      title: "In logo chậu & túi quà theo yêu cầu",
      caption: "Thiết kế market mẫu miễn phí, in sắc nét, bền màu theo nhận diện thương hiệu",
    },
    {
      id: "srv-package",
      enabled: true,
      imageUrl: "/banners/trust/dich-vu-goi-qua.webp",
      title: "Gói quà trọn bộ & thiệp chúc mừng",
      caption: "Kèm túi đựng, thẻ hướng dẫn chăm sóc từng loại cây, túi sỏi rải chậu tinh tế",
    },
    {
      id: "srv-bulk",
      enabled: true,
      imageUrl: "/banners/trust/dich-vu-so-luong-lon.webp",
      title: "Cung cấp đơn hàng số lượng lớn",
      caption: "Chiết khấu doanh nghiệp tốt nhất, đồng đều chất lượng, đóng thùng giao tận nơi",
    },
  ],
  gallery: [
    {
      id: "store-1",
      enabled: true,
      imageUrl: "/banners/trust/cua-hang-1.webp",
      title: "Kệ trưng bày sen đá & cây mini",
      caption: "Cây thuần khoẻ, gắn nhãn thông tin rõ ràng",
      kind: "store",
    },
    {
      id: "store-2",
      enabled: true,
      imageUrl: "/banners/trust/cua-hang-2.webp",
      title: "Khu vực cây cảnh văn phòng & để bàn",
      caption: "Đa dạng chủng loại, cây xanh mướt được chăm sóc kỹ",
      kind: "store",
    },
    {
      id: "store-3",
      enabled: true,
      imageUrl: "/banners/trust/cua-hang-3.webp",
      title: "Góc tiểu cảnh & chậu nghệ thuật",
      caption: "Không gian xanh thoáng đãng đón khách ghé chọn trực tiếp",
      kind: "store",
    },
    {
      id: "store-4",
      enabled: true,
      imageUrl: "/banners/trust/cua-hang-4.webp",
      title: "Hàng chậu gốm & phụ kiện trồng cây",
      caption: "Đầy đủ vật tư chất lượng cho người yêu cây",
      kind: "store",
    },
    {
      id: "cust-hs-1",
      enabled: true,
      imageUrl: "/banners/trust/khach-hang-hoc-sinh-1.webp",
      title: "Hai bạn học sinh ghé chọn cây",
      caption: "Trải nghiệm chọn sen đá và cây cảnh mini tại shop Aloha",
      kind: "customer",
    },
    {
      id: "cust-hs-2",
      enabled: true,
      imageUrl: "/banners/trust/khach-hang-hoc-sinh-2.webp",
      title: "Khách hàng học sinh nhận cây tại quầy",
      caption: "Cây mini để bàn học được các bạn trẻ yêu thích",
      kind: "customer",
    },
    {
      id: "cust-cam-1",
      enabled: true,
      imageUrl: "/banners/trust/khach-hang-camera-1.webp",
      title: "Khách mua hàng thực tế tại quầy",
      caption: "Hình ảnh camera quầy thu ngân phục vụ khách hàng trực tiếp",
      kind: "customer",
    },
    {
      id: "cust-cam-2",
      enabled: true,
      imageUrl: "/banners/trust/khach-hang-camera-2.webp",
      title: "Không khí mua sắm tại cửa hàng",
      caption: "Khách ghé thanh toán và đóng gói chậu cây mang về",
      kind: "customer",
    },
  ],
  marketplaces: [
    {
      id: "mp-shopee",
      enabled: true,
      platform: "shopee",
      label: "Gian hàng chính hãng Shopee",
      url: "https://shopee.vn",
      note: "Giao hàng toàn quốc · Đánh giá 4.9★",
    },
    {
      id: "mp-tiktok",
      enabled: true,
      platform: "tiktok",
      label: "TikTok Shop Aloha",
      url: "https://www.tiktok.com",
      note: "Live chốt đơn trực tiếp tại vườn",
    },
  ],
  cta: {
    label: "Nhận báo giá quà tặng doanh nghiệp qua Zalo",
    href: "https://zalo.me/0794901233",
  },
};

export function parseTrustProps(raw?: Record<string, unknown>): Required<TrustSectionProps> {
  if (!raw) return DEFAULT_TRUST_PROPS;
  const p = raw as TrustSectionProps;
  return {
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : DEFAULT_TRUST_PROPS.title,
    subtitle: typeof p.subtitle === "string" ? p.subtitle.trim() : DEFAULT_TRUST_PROPS.subtitle,
    clientsTitle:
      typeof p.clientsTitle === "string" && p.clientsTitle.trim()
        ? p.clientsTitle.trim()
        : DEFAULT_TRUST_PROPS.clientsTitle,
    clients: Array.isArray(p.clients) ? p.clients : DEFAULT_TRUST_PROPS.clients,
    services: Array.isArray(p.services) ? p.services : DEFAULT_TRUST_PROPS.services,
    gallery: Array.isArray(p.gallery) ? p.gallery : DEFAULT_TRUST_PROPS.gallery,
    marketplaces: Array.isArray(p.marketplaces) ? p.marketplaces : DEFAULT_TRUST_PROPS.marketplaces,
    cta: p.cta?.label && p.cta?.href ? p.cta : DEFAULT_TRUST_PROPS.cta,
  };
}
