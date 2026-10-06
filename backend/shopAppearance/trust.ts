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
  clients: TrustItem[];
  services: TrustItem[];
  gallery: TrustItem[];
  marketplaces: TrustMarketplace[];
  cta?: { label: string; href: string };
};

/** Dữ liệu mặc định đầy đủ cho khối Độ tin cậy dựa trên bộ ảnh thực tế đã chuẩn hoá */
export const DEFAULT_TRUST_PROPS: TrustSectionProps = {
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
      enabled: false,
      imageUrl: "/banners/trust/don-tay-ninh.webp",
      title: "Tỉnh Đoàn Tây Ninh",
      caption: "Chậu vuông kỷ niệm Hội LHTN Việt Nam (Chờ xác nhận)",
    },
    {
      id: "hoang-gia",
      enabled: false,
      imageUrl: "/banners/trust/don-hoang-gia.webp",
      title: "Hoàng Gia",
      caption: "Chậu sen đá quà tặng in thương hiệu (Chờ xác nhận)",
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
      note: "Giao hàng toàn quốc · Đánh giá tích cực",
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

function isValidImageUrl(u: string): boolean {
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (!s) return false;
  // Cho phép ảnh nội bộ /banners/ hoặc /uploads/ hoặc link https an toàn
  return s.startsWith("/banners/") || s.startsWith("/uploads/shop-appearance/") || s.startsWith("https://");
}

function isValidCtaHref(u: string): boolean {
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (!s) return false;
  // Chặn tuyệt đối javascript: và data:
  if (/^javascript:/i.test(s) || /^data:/i.test(s)) return false;
  return s.startsWith("https://") || s.startsWith("/") || s.startsWith("http://");
}

function isValidHttpsUrl(u: string): boolean {
  if (typeof u !== "string") return false;
  const s = u.trim();
  return s.startsWith("https://");
}

function cleanStr(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

/** Chuẩn hoá và làm sạch dữ liệu props của trust_section trước khi lưu trữ */
export function normalizeTrustProps(raw: unknown): TrustSectionProps {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_TRUST_PROPS };
  }
  const obj = raw as Record<string, unknown>;

  const title = cleanStr(obj.title, 150) || DEFAULT_TRUST_PROPS.title;
  const subtitle = cleanStr(obj.subtitle, 300) || DEFAULT_TRUST_PROPS.subtitle;
  const clientsTitle = cleanStr(obj.clientsTitle, 150) || DEFAULT_TRUST_PROPS.clientsTitle;

  const normalizeItem = (item: unknown, maxTitle = 120, maxCap = 300): TrustItem | null => {
    if (!item || typeof item !== "object") return null;
    const it = item as Record<string, unknown>;
    const title = cleanStr(it.title, maxTitle);
    const imageUrl = cleanStr(it.imageUrl, 500);
    if (!title || !isValidImageUrl(imageUrl)) return null;

    const logoUrl = cleanStr(it.logoUrl, 500);
    const caption = cleanStr(it.caption, maxCap);
    const kind = it.kind === "customer" ? "customer" : it.kind === "store" ? "store" : undefined;

    return {
      id: cleanStr(it.id, 64) || `tr-${Math.random().toString(36).slice(2, 9)}`,
      enabled: it.enabled !== false,
      imageUrl,
      ...(logoUrl && isValidImageUrl(logoUrl) ? { logoUrl } : {}),
      title,
      ...(caption ? { caption } : {}),
      ...(kind ? { kind } : {}),
    };
  };

  const clients = Array.isArray(obj.clients)
    ? obj.clients
        .map((x) => normalizeItem(x))
        .filter((x): x is TrustItem => Boolean(x))
        .slice(0, 12)
    : DEFAULT_TRUST_PROPS.clients;

  const services = Array.isArray(obj.services)
    ? obj.services
        .map((x) => normalizeItem(x))
        .filter((x): x is TrustItem => Boolean(x))
        .slice(0, 6)
    : DEFAULT_TRUST_PROPS.services;

  const gallery = Array.isArray(obj.gallery)
    ? obj.gallery
        .map((x) => normalizeItem(x))
        .filter((x): x is TrustItem => Boolean(x))
        .slice(0, 16)
    : DEFAULT_TRUST_PROPS.gallery;

  const marketplaces = Array.isArray(obj.marketplaces)
    ? obj.marketplaces
        .map((item): TrustMarketplace | null => {
          if (!item || typeof item !== "object") return null;
          const it = item as Record<string, unknown>;
          const label = cleanStr(it.label, 100);
          const url = cleanStr(it.url, 500);
          if (!label || !isValidHttpsUrl(url)) return null;
          const platform =
            it.platform === "shopee" || it.platform === "lazada" || it.platform === "tiktok"
              ? it.platform
              : "khac";
          const note = cleanStr(it.note, 150);
          return {
            id: cleanStr(it.id, 64) || `mp-${Math.random().toString(36).slice(2, 9)}`,
            enabled: it.enabled !== false,
            platform,
            label,
            url,
            ...(note ? { note } : {}),
          };
        })
        .filter((x): x is TrustMarketplace => Boolean(x))
        .slice(0, 6)
    : DEFAULT_TRUST_PROPS.marketplaces;

  let cta: { label: string; href: string } | undefined = undefined;
  if (obj.cta && typeof obj.cta === "object") {
    const c = obj.cta as Record<string, unknown>;
    const label = cleanStr(c.label, 120);
    const href = cleanStr(c.href, 500);
    if (label && isValidCtaHref(href)) {
      cta = { label, href };
    }
  }
  if (!cta) {
    cta = DEFAULT_TRUST_PROPS.cta;
  }

  return {
    title,
    subtitle,
    clientsTitle,
    clients,
    services,
    gallery,
    marketplaces,
    cta,
  };
}
