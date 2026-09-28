import type { AppearanceBlock, AppearanceLayout, AppearanceTheme } from "../api";

export const SHOP_PREVIEW_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHOP_PREVIEW_URL) ||
  "http://localhost:3002";

export const COLOR_PRESETS = [
  "#2E7D32",
  "#4CAF50",
  "#1B5E20",
  "#FF6F61",
  "#FF6800",
  "#EF4444",
  "#F59E0B",
  "#3B82F6",
  "#333333",
  "#6B7280",
  "#E8F5E9",
  "#F1F8EF",
  "#FDF6E3",
  "#FFF8E1",
  "#E8DCC6",
  "#FFFFFF",
];

export const HEADER_FOR_PRIMARY = "#FFFFFF";

export type SidePanel = "brand" | "home" | "menu" | "footer";

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyPopup(): NonNullable<AppearanceTheme["popup"]> {
  return {
    enabled: false,
    campaignId: "promo",
    title: "Giảm giá đặc biệt",
    body: "Nhập mã bên dưới khi thanh toán — áp dụng cho đơn trên web.",
    imageUrl: "",
    ctaLabel: "Dùng mã ngay",
    ctaHref: "/tim",
    couponCode: "ALOHA10",
    delaySeconds: 3,
    frequencyDays: 7,
    showOncePerCampaign: true,
  };
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function splitLocalFromIso(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "" };
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { date: "", time: "" };
  const d = new Date(t);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/** Ghép ngày + giờ máy local → ISO UTC để lưu server. */
export function combineLocalToIso(date: string, time: string): string | null {
  const d = date.trim();
  const tm = (time.trim() || "00:00").slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}$/.test(tm)) return null;
  const parsed = Date.parse(`${d}T${tm}:00`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function formatScheduleVi(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const ngay = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const gio = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${gio} ngày ${ngay}`;
}

/** Đảm bảo có khối «Sản phẩm nổi bật» + «Sản phẩm mới» trong danh sách trang chủ. */
export function ensureCoreHomeProductBlocks(
  layout: AppearanceLayout
): AppearanceLayout {
  let blocks = [...layout.blocks];

  const isHot = (b: AppearanceBlock) =>
    b.type === "product_section" &&
    (String(b.props?.source || "") === "ban_chay" ||
      String(b.props?.source || "") === "ban_chay_sap_het");

  const hasNoiBat = blocks.some(
    (b) =>
      b.type === "product_section" &&
      String(b.props?.source || "") === "noi_bat"
  );
  if (!hasNoiBat) {
    const noiBatBlock: AppearanceBlock = {
      id: newId("noi_bat"),
      type: "product_section",
      enabled: true,
      props: {
        title: "Sản phẩm nổi bật",
        source: "noi_bat",
        limit: 6,
        sort: "ten",
      },
    };
    const hotIdx = blocks.findIndex(isHot);
    if (hotIdx >= 0) blocks.splice(hotIdx, 0, noiBatBlock);
    else {
      const featureIdx = blocks.findIndex((b) => b.type === "feature_strip");
      blocks.splice(featureIdx >= 0 ? featureIdx + 1 : 0, 0, noiBatBlock);
    }
  }

  const hasMoi = blocks.some(
    (b) =>
      b.type === "product_section" && String(b.props?.source || "") === "moi"
  );
  if (!hasMoi) {
    const moiBlock: AppearanceBlock = {
      id: newId("moi"),
      type: "product_section",
      enabled: true,
      props: {
        title: "Sản phẩm mới",
        source: "moi",
        limit: 50,
        sort: "moi",
      },
    };
    const hotIdx = blocks.findIndex(isHot);
    if (hotIdx >= 0) blocks.splice(hotIdx + 1, 0, moiBlock);
    else {
      const noiBatIdx = blocks.findIndex(
        (b) =>
          b.type === "product_section" &&
          String(b.props?.source || "") === "noi_bat"
      );
      if (noiBatIdx >= 0) blocks.splice(noiBatIdx + 1, 0, moiBlock);
      else {
        const featureIdx = blocks.findIndex((b) => b.type === "feature_strip");
        blocks.splice(featureIdx >= 0 ? featureIdx + 1 : 0, 0, moiBlock);
      }
    }
  }

  return { ...layout, blocks };
}
