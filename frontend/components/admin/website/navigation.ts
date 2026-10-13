import { FileText, Gift, LayoutTemplate, Package } from "lucide-react";
export const WEBSITE_SECTIONS = [
  { tab: "giao-dien", label: "Giao diện", Icon: LayoutTemplate },
  { tab: "qua-tang", label: "Quà tặng", Icon: Gift },
  { tab: "bao-gia", label: "Yêu cầu báo giá", Icon: FileText },
  { tab: "hang-hoa-web", label: "Hàng hóa web", Icon: Package },
  { tab: "bai-viet", label: "Bài viết", Icon: FileText },
] as const;
export function websiteSection(tab: string | null | undefined) {
  return WEBSITE_SECTIONS.find(section => section.tab === tab) || WEBSITE_SECTIONS[0];
}
