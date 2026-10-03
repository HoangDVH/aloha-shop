/**
 * Bảng màu chiến dịch theo dịp, đồng bộ với `backend/shopCampaigns/presets.ts`.
 * `primary` (thanh thông báo, nút voucher header) và `accent` (chỉ trong trang ưu đãi) luôn nằm dưới chữ trắng
 * nên phải đủ tương phản WCAG AA (≥ 4.5:1) với #FFFFFF; `cream` là nền sáng cho khối nội dung.
 */
export type CampaignColors = { primary: string; accent: string; cream: string };

export type CampaignPalette = { key: string; label: string; hint: string; colors: CampaignColors };

export const CAMPAIGN_PALETTES: CampaignPalette[] = [
  { key: "aloha", label: "Xanh Aloha", hint: "Mặc định, chiến dịch tự tạo", colors: { primary: "#0B4D3B", accent: "#C62828", cream: "#FFF4DC" } },
  { key: "double-day", label: "Cam sale 9.9, 10.10", hint: "Ngày đôi giữa năm, kiểu Shopee", colors: { primary: "#D73211", accent: "#C8102E", cream: "#FFF3E0" } },
  { key: "mega-sale", label: "Đỏ cam 11.11", hint: "Siêu sale lớn nhất năm", colors: { primary: "#B71C1C", accent: "#D73211", cream: "#FFF3E0" } },
  { key: "year-end", label: "Đỏ xanh 12.12", hint: "Sale cuối năm, chạm Giáng sinh", colors: { primary: "#C8102E", accent: "#1B5E20", cream: "#FFF8E1" } },
  { key: "women", label: "Hồng tím 20/10, 8/3", hint: "Ngày Phụ nữ, quà tặng", colors: { primary: "#C2185B", accent: "#7B1FA2", cream: "#FFF0F5" } },
  { key: "valentine", label: "Đỏ hồng 14/2", hint: "Valentine", colors: { primary: "#BE123C", accent: "#DB2777", cream: "#FFF1F2" } },
  { key: "national", label: "Đỏ vàng 2/9, 30/4", hint: "Lễ Quốc khánh, Giải phóng", colors: { primary: "#C8102E", accent: "#B45309", cream: "#FFF8E1" } },
  { key: "tet", label: "Đỏ vàng Tết", hint: "Tết Nguyên đán", colors: { primary: "#B71C1C", accent: "#B45309", cream: "#FFF8E1" } },
  { key: "mid-autumn", label: "Cam chàm Trung thu", hint: "Đèn lồng, đêm trăng", colors: { primary: "#9A3412", accent: "#4338CA", cream: "#FFF7E6" } },
  { key: "noel", label: "Xanh đỏ Giáng sinh", hint: "Noel", colors: { primary: "#1B5E20", accent: "#C62828", cream: "#FFF8E7" } },
  { key: "black-friday", label: "Đen đỏ Black Friday", hint: "Cuối tháng 11", colors: { primary: "#111827", accent: "#DC2626", cream: "#FFF7ED" } },
];

export function paletteByKey(key: string): CampaignPalette | undefined {
  return CAMPAIGN_PALETTES.find((p) => p.key === key);
}

/** Bảng màu trùng khớp với màu đang chọn (không phân biệt hoa thường). */
export function matchPalette(colors: CampaignColors): CampaignPalette | undefined {
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return CAMPAIGN_PALETTES.find((p) => eq(p.colors.primary, colors.primary) && eq(p.colors.accent, colors.accent) && eq(p.colors.cream, colors.cream));
}
