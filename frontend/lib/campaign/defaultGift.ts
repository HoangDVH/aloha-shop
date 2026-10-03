import { rowGifts, withGifts, type CampaignProductAdmin } from "./campaignAdminApi";

/** Quà mặc định khi admin không cài quà: túi giấy cho cây thành phẩm. */
export const DEFAULT_GIFT_MA = "TGMK";
/** Nhóm KiotViet (kể cả mọi nhóm con) được tặng quà mặc định. */
export const DEFAULT_GIFT_GROUPS = ["CÂY THÀNH PHẨM TRỒNG SẴN", "CÂY THÀNH PHẨM SALE"];

const norm = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN");
const GROUPS = new Set(DEFAULT_GIFT_GROUPS.map(norm));

/** So từng cấp của "Cha >> Con", nên SP ở nhóm con (vd. "… SALE ĐỒNG GIÁ 170K" dưới "CÂY THÀNH PHẨM SALE") cũng được tính. */
export function inDefaultGiftGroup(nhomPath: string | undefined): boolean {
  return String(nhomPath || "")
    .split(">>")
    .some((seg) => GROUPS.has(norm(seg)));
}

/** Gắn túi giấy cho dòng chưa có quà thuộc nhóm cây thành phẩm; dòng đã có quà hoặc nhóm khác giữ nguyên. */
export function withDefaultGift(row: CampaignProductAdmin, nhomPath: string | undefined): CampaignProductAdmin {
  if (rowGifts(row).length || !inDefaultGiftGroup(nhomPath) || row.ma === DEFAULT_GIFT_MA) return row;
  return withGifts(row, [{ ma: DEFAULT_GIFT_MA, qty: 1, quota: Math.max(1, row.quota) }]);
}
