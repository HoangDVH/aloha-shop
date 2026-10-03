import type { CampaignContent, CampaignDisplay } from "./types.js";
import { vnMidnight } from "./campaignPhase.js";

type PresetDef = {
  key: string;
  label: string;
  name: string;
  slug: string;
  /** Tháng/ngày bắt đầu (giờ VN); null = tự chọn ngày. */
  month: number | null;
  day: number | null;
  days: number;
  colors: CampaignDisplay["colors"];
  title: string;
  subtitle: string;
};

/** Cùng mã màu với `frontend/lib/campaign/campaignPalettes.ts` (test so khớp hai bên). */
export const PRESET_COLORS = {
  aloha: { primary: "#0B4D3B", accent: "#C62828", cream: "#FFF4DC" },
  doubleDay: { primary: "#D73211", accent: "#C8102E", cream: "#FFF3E0" },
  megaSale: { primary: "#B71C1C", accent: "#D73211", cream: "#FFF3E0" },
  yearEnd: { primary: "#C8102E", accent: "#1B5E20", cream: "#FFF8E1" },
  women: { primary: "#C2185B", accent: "#7B1FA2", cream: "#FFF0F5" },
  valentine: { primary: "#BE123C", accent: "#DB2777", cream: "#FFF1F2" },
  national: { primary: "#C8102E", accent: "#B45309", cream: "#FFF8E1" },
  tet: { primary: "#B71C1C", accent: "#B45309", cream: "#FFF8E1" },
  noel: { primary: "#1B5E20", accent: "#C62828", cream: "#FFF8E7" },
} satisfies Record<string, CampaignDisplay["colors"]>;

const C = PRESET_COLORS;

const PRESETS: PresetDef[] = [
  { key: "tet", label: "Tết Nguyên đán", name: "Tết sum vầy", slug: "tet-sum-vay", month: 1, day: 15, days: 14, colors: C.tet, title: "TẾT SUM VẦY – CÂY TÀI LỘC", subtitle: "Mai, đào, kim ngân – giao trước Tết" },
  { key: "14-2", label: "Valentine 14/2", name: "Valentine 14/2", slug: "valentine-14-2", month: 2, day: 12, days: 3, colors: C.valentine, title: "14/2 – TẶNG CÂY THAY LỜI YÊU", subtitle: "Cây xinh làm quà, giao đúng ngày" },
  { key: "8-3", label: "Quốc tế Phụ nữ 8/3", name: "Mừng 8/3", slug: "mung-8-3", month: 3, day: 6, days: 3, colors: C.women, title: "8/3 – TẶNG CÂY, TẶNG YÊU THƯƠNG", subtitle: "Cây xinh làm quà, giao tận nơi" },
  { key: "30-4", label: "Lễ 30/4 – 1/5", name: "Đại lễ 30/4 – 1/5", slug: "dai-le-30-4", month: 4, day: 28, days: 5, colors: C.national, title: "30/4 – 1/5 – NGHỈ LỄ SĂN CÂY GIÁ SỐC", subtitle: "Giảm đến 50%, quà tặng kèm, voucher đến 100K" },
  { key: "2-9", label: "Đại lễ 2/9", name: "Đại lễ 2/9", slug: "dai-le-2-9", month: 9, day: 1, days: 3, colors: C.national, title: "ĐẠI LỄ 2/9 – SĂN CÂY GIÁ SỐC", subtitle: "Giảm đến 50%, quà tặng kèm, voucher đến 100K" },
  { key: "9-9", label: "Sale 9.9", name: "Sale 9.9", slug: "sale-9-9", month: 9, day: 9, days: 1, colors: C.doubleDay, title: "9.9 – NGÀY SALE CÂY CẢNH", subtitle: "Giá sốc theo khung giờ, số lượng có hạn" },
  { key: "10-10", label: "Sale 10.10", name: "Sale 10.10", slug: "sale-10-10", month: 10, day: 10, days: 1, colors: C.doubleDay, title: "10.10 – NGÀY SALE CÂY CẢNH", subtitle: "Giá sốc theo khung giờ, số lượng có hạn" },
  { key: "20-10", label: "Phụ nữ Việt Nam 20/10", name: "Mừng 20/10", slug: "mung-20-10", month: 10, day: 18, days: 3, colors: C.women, title: "20/10 – TẶNG CÂY, TẶNG YÊU THƯƠNG", subtitle: "Cây xinh làm quà, giao tận nơi" },
  { key: "11-11", label: "Siêu sale 11/11", name: "Siêu sale 11/11", slug: "sieu-sale-11-11", month: 11, day: 11, days: 1, colors: C.megaSale, title: "11.11 – SIÊU SALE CÂY CẢNH", subtitle: "Giá sốc theo khung giờ, số lượng có hạn" },
  { key: "12-12", label: "Sale cuối năm 12/12", name: "Sale 12/12", slug: "sale-12-12", month: 12, day: 12, days: 1, colors: C.yearEnd, title: "12.12 – SALE CUỐI NĂM", subtitle: "Voucher đến 100K, hỗ trợ phí ship nội thành" },
  { key: "noel", label: "Giáng sinh", name: "Giáng sinh an lành", slug: "giang-sinh", month: 12, day: 20, days: 6, colors: C.noel, title: "GIÁNG SINH XANH – QUÀ CÂY Ý NGHĨA", subtitle: "Cây thông, trạng nguyên, quà tặng kèm" },
  { key: "custom", label: "Tự tạo", name: "Chiến dịch mới", slug: "chien-dich-moi", month: null, day: null, days: 3, colors: C.aloha, title: "ƯU ĐÃI ĐẶC BIỆT", subtitle: "Giá tốt, số lượng có hạn" },
];

export function listPresets() {
  return PRESETS.map(({ key, label }) => ({ key, label }));
}

/** Ngày bắt đầu kế tiếp của mẫu (00:00 giờ VN), không lùi về quá khứ. */
function nextStart(p: PresetDef, nowMs: number): number {
  if (p.month == null || p.day == null) return vnMidnight(nowMs) + 7 * 86_400_000;
  const year = new Date(nowMs + 7 * 3600_000).getUTCFullYear();
  for (const y of [year, year + 1]) {
    const ms = Date.UTC(y, p.month - 1, p.day) - 7 * 3600_000;
    if (ms > nowMs) return ms;
  }
  return Date.UTC(year + 1, p.month - 1, p.day) - 7 * 3600_000;
}

function defaultDisplay(p: PresetDef): CampaignDisplay {
  return {
    colors: { ...p.colors },
    announcement: { text: `${p.name}: giảm đến 50% – số lượng có hạn`, href: "/uu-dai" },
    headerPill: { text: "Voucher 50K đơn đầu", href: "/uu-dai?tab=voucher" },
    banners: [],
    hero: {
      title: p.title,
      subtitle: p.subtitle,
      benefits: ["Giảm đến 50%", "Quà tặng kèm", "Voucher đến 100K", "Giao nhanh nội thành"],
      tags: ["Cây khoẻ, đổi trả 7 ngày", "Thanh toán khi nhận hàng"],
      primaryCta: { label: "Săn deal ngay", href: "/uu-dai?tab=flash-sale" },
      secondaryCta: { label: "Lưu voucher", href: "/uu-dai?tab=voucher" },
    },
    tiles: [
      { icon: "ticket", label: "Kho voucher", href: "/uu-dai?tab=voucher" },
      { icon: "zap", label: "Flash Sale", href: "/uu-dai?tab=flash-sale" },
      { icon: "flame", label: "Deal hot", href: "/uu-dai?tab=deal-hot" },
      { icon: "gift", label: "Quà tặng", href: "/uu-dai?tab=qua-tang" },
      { icon: "truck", label: "Hỗ trợ ship", href: "/uu-dai?tab=voucher" },
    ],
    welcome: { enabled: true, title: "Quà cho bạn mới", body: "Lưu voucher để dùng khi đặt hàng trong dịp lễ." },
    flashStage: {
      title: `Flash Sale ${p.name}`.toLocaleUpperCase("vi-VN").slice(0, 60),
      badge: "Giá sốc",
      subtitle: "Số lượng có hạn, làm mới mỗi khung giờ – Cam kết cây tươi nguyên bản",
    },
  };
}

export function buildPresetContent(key: string, nowMs: number): CampaignContent {
  const p = PRESETS.find((x) => x.key === key) || PRESETS[PRESETS.length - 1];
  const start = nextStart(p, nowMs);
  const end = start + p.days * 86_400_000 - 60_000;
  return {
    info: {
      name: p.name,
      slug: p.slug,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      teaserDays: 3,
      testOnly: false,
    },
    products: [],
    slots: [],
    voucherIds: [],
    display: defaultDisplay(p),
  };
}
