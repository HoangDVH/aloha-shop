import type { Db } from "mongodb";
import type { CampaignContent } from "../../backend/shopCampaigns/types.js";
import { PROMOTIONS_COL } from "../../backend/shopPromotions/types.js";
import { V30K, VSHIP_LUU } from "./walletFixtures.js";

/** Sản phẩm mẫu mục 0 của tài liệu test: giá thường, giá vốn, tồn. */
export const CATALOG = [
  { ma: "SP_A", ten: "Cây SP_A", giaWeb: 200_000, giaVon: 90_000, ton: 50 },
  { ma: "SP_B", ten: "Cây SP_B", giaWeb: 500_000, ton: 20 },
  { ma: "SP_C", ten: "Cây SP_C", giaWeb: 80_000, ton: 3 },
  { ma: "QUA_G", ten: "Hộp quà", giaWeb: 30_000, ton: 5 },
];

/** Để bước "Kiểm tra trước khi bật" tìm thấy sản phẩm / voucher của `daiLeContent`. */
export async function seedCampaignCatalog(db: Db): Promise<void> {
  await db.collection("aloha_products").deleteMany({ ma: { $in: CATALOG.map((p) => p.ma) } });
  await db.collection("aloha_products").insertMany(CATALOG.map((p) => ({ ...p, deletedAt: null, hienThiWeb: true })));
  await db.collection(PROMOTIONS_COL).deleteMany({ id: { $in: ["V30K", "VSHIP_LUU"] } });
  await db.collection(PROMOTIONS_COL).insertMany([V30K(), VSHIP_LUU()] as any[]);
}

/** Giờ Việt Nam → epoch ms, ví dụ vn("2026-10-01T09:00"). */
export const vn = (local: string) => Date.parse(`${local}:00+07:00`);

export function daiLeContent(overrides: Partial<CampaignContent["info"]> = {}): CampaignContent {
  return {
    info: {
      name: "Đại lễ",
      slug: "dai-le",
      startAt: new Date(vn("2026-10-01T00:00")).toISOString(),
      endAt: new Date(vn("2026-10-03T23:59")).toISOString(),
      teaserDays: 3,
      testOnly: false,
      ...overrides,
    },
    slots: [
      { key: "S09", start: "09:00", end: "11:59" },
      { key: "S12", start: "12:00", end: "15:59" },
      { key: "S20", start: "20:00", end: "23:59" },
    ],
    products: [
      { ma: "SP_A", salePrice: 124_000, quota: 10, perCustomerLimit: 2 },
      { ma: "SP_C", salePrice: 50_000, quota: 5, perCustomerLimit: 2, slotKey: "S20" },
      { ma: "SP_B", salePrice: 0, quota: 0, perCustomerLimit: 2, gift: { ma: "QUA_G", qty: 1, quota: 3 } },
    ],
    voucherIds: ["V30K", "VSHIP_LUU"],
    display: {
      colors: { primary: "#0B4D3B", accent: "#E53935", cream: "#FFF4DC" },
      announcement: { text: "Đại lễ giảm đến 50%", href: "/uu-dai" },
      headerPill: { text: "Voucher 50K", href: "/uu-dai#voucher" },
      banners: [{ id: "b1", kind: "main", imageUrl: "/uploads/banner.jpg", href: "/uu-dai" }],
      hero: { title: "ĐẠI LỄ", subtitle: "Săn cây giá sốc", benefits: ["Giảm 50%"], tags: [] },
      tiles: [{ icon: "ticket", label: "Kho voucher", href: "/uu-dai#voucher" }],
      welcome: { enabled: true, title: "Quà cho bạn mới", body: "Lưu voucher ngay" },
    },
  };
}
