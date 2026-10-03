import type { Db } from "mongodb";
import { PROMOTIONS_COL } from "../../shopPromotions/types.js";
import { loadCampaignStats } from "../stats/campaignStats.js";
import { FLASH_COUNTERS_COL, type CampaignDoc } from "../types.js";
import { loadProductFacts } from "./productFacts.js";

export type FlashReportRow = { day: string; slot: string; ma: string; ten: string; quota: number; sold: number; held: number };
export type GiftReportRow = { parentMa: string; giftMa: string; ten: string; quota: number; sold: number; held: number };
export type VoucherReportRow = { id: string; code: string; name: string; claimed: number; used: number };
export type BannerReportRow = { bannerId: string; clicks: number };

export type CampaignReport = {
  name: string;
  flash: FlashReportRow[];
  gifts: GiftReportRow[];
  vouchers: VoucherReportRow[];
  banners: BannerReportRow[];
  views: number;
  clicks: number;
  /** Tỉ lệ bấm banner = lượt bấm / lượt xem, 0 khi chưa có lượt xem. */
  ctr: number;
  reminds: { ma: string; count: number }[];
};

type Counter = { _id: string; kind: string; quota?: number; sold?: number; held?: number };

/** `camp:ngày:khung:MA` → ngày, khung, mã. */
function parseFlashId(campaignId: string, id: string) {
  const [day = "", slot = "", ...rest] = id.slice(campaignId.length + 1).split(":");
  return { day, slot: slot === "ALLDAY" ? "Cả ngày" : slot, ma: rest.join(":") };
}

/** `gift:camp:SP_CHÍNH:QUÀ` → mã SP chính, mã quà. */
function parseGiftId(campaignId: string, id: string) {
  const [parentMa = "", ...rest] = id.slice(`gift:${campaignId}:`.length).split(":");
  return { parentMa, giftMa: rest.join(":") };
}

/** Số liệu báo cáo đọc thẳng từ bộ đếm suất, voucher và thống kê lượt bấm của chiến dịch (AD16). */
export async function buildCampaignReport(db: Db, doc: CampaignDoc): Promise<CampaignReport> {
  const content = doc.published || doc.draft;
  const [counters, vouchers, stats] = await Promise.all([
    db.collection<Counter>(FLASH_COUNTERS_COL).find({ campaignId: doc._id, kind: { $in: ["flash", "gift"] } }).toArray(),
    db.collection(PROMOTIONS_COL).find({ id: { $in: content.voucherIds } }, { projection: { id: 1, code: 1, name: 1, claimedCount: 1, usedCount: 1 } }).toArray(),
    loadCampaignStats(db, doc._id),
  ]);
  const num = (v: unknown) => Number(v) || 0;
  const flashRaw = counters.filter((c) => c.kind === "flash").map((c) => ({ c, ...parseFlashId(doc._id, c._id) }));
  const giftRaw = counters.filter((c) => c.kind === "gift").map((c) => ({ c, ...parseGiftId(doc._id, c._id) }));
  const facts = await loadProductFacts(db, [...new Set([...flashRaw.map((r) => r.ma), ...giftRaw.map((r) => r.giftMa)])]);
  const ten = (ma: string) => facts.get(ma)?.ten || "";

  const flash = flashRaw
    .map(({ c, day, slot, ma }) => ({ day, slot, ma, ten: ten(ma), quota: num(c.quota), sold: num(c.sold), held: num(c.held) }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.slot.localeCompare(b.slot) || a.ma.localeCompare(b.ma));
  const gifts = giftRaw
    .map(({ c, parentMa, giftMa }) => ({ parentMa, giftMa, ten: ten(giftMa), quota: num(c.quota), sold: num(c.sold), held: num(c.held) }))
    .sort((a, b) => a.parentMa.localeCompare(b.parentMa));
  const byId = new Map(vouchers.map((v) => [String(v.id), v]));
  const views = num(stats.totals.bannerView);
  const clicks = num(stats.totals.bannerClick);
  return {
    name: content.info.name,
    flash,
    gifts,
    vouchers: content.voucherIds.map((id) => {
      const v = byId.get(id);
      return { id, code: String(v?.code || id), name: String(v?.name || ""), claimed: num(v?.claimedCount), used: num(v?.usedCount) };
    }),
    banners: Object.entries(stats.banners).map(([bannerId, n]) => ({ bannerId, clicks: num(n) })),
    views,
    clicks,
    ctr: views ? clicks / views : 0,
    reminds: Object.entries(stats.reminds).map(([ma, count]) => ({ ma, count: num(count) })),
  };
}

type Sheet = { name: string; columns: { header: string; key: string; width: number }[]; rows: Record<string, unknown>[] };

function sheetsOf(r: CampaignReport): Sheet[] {
  return [
    {
      name: "Tong quan",
      columns: [{ header: "Chỉ số", key: "k", width: 34 }, { header: "Giá trị", key: "v", width: 16 }],
      rows: [
        { k: "Chiến dịch", v: r.name },
        { k: "Suất flash đã bán", v: r.flash.reduce((s, x) => s + x.sold, 0) },
        { k: "Quà đã tặng", v: r.gifts.reduce((s, x) => s + x.sold, 0) },
        { k: "Lượt lưu voucher", v: r.vouchers.reduce((s, x) => s + x.claimed, 0) },
        { k: "Lượt dùng voucher", v: r.vouchers.reduce((s, x) => s + x.used, 0) },
        { k: "Lượt xem banner", v: r.views },
        { k: "Lượt bấm banner", v: r.clicks },
        { k: "Tỉ lệ bấm (%)", v: Math.round(r.ctr * 10000) / 100 },
      ],
    },
    {
      name: "Flash theo khung",
      columns: [
        { header: "Ngày", key: "day", width: 12 }, { header: "Khung", key: "slot", width: 10 }, { header: "Mã", key: "ma", width: 14 },
        { header: "Tên", key: "ten", width: 40 }, { header: "Số suất", key: "quota", width: 10 }, { header: "Đã bán", key: "sold", width: 10 },
        { header: "Đang giữ", key: "held", width: 10 },
      ],
      rows: r.flash,
    },
    {
      name: "Voucher",
      columns: [
        { header: "Mã", key: "code", width: 16 }, { header: "Tên", key: "name", width: 34 },
        { header: "Lượt lưu", key: "claimed", width: 12 }, { header: "Lượt dùng", key: "used", width: 12 },
      ],
      rows: r.vouchers,
    },
    {
      name: "Qua tang",
      columns: [
        { header: "SP chính", key: "parentMa", width: 14 }, { header: "Mã quà", key: "giftMa", width: 14 }, { header: "Tên quà", key: "ten", width: 36 },
        { header: "Số quà", key: "quota", width: 10 }, { header: "Đã tặng", key: "sold", width: 10 }, { header: "Đang giữ", key: "held", width: 10 },
      ],
      rows: r.gifts,
    },
    {
      name: "Banner & nhac",
      columns: [{ header: "Banner / Mã SP", key: "id", width: 30 }, { header: "Loại", key: "type", width: 14 }, { header: "Số lượt", key: "n", width: 12 }],
      rows: [
        ...r.banners.map((b) => ({ id: b.bannerId, type: "Bấm banner", n: b.clicks })),
        ...r.reminds.map((m) => ({ id: m.ma, type: "Nhắc tôi", n: m.count })),
      ],
    },
  ];
}

/** File .xlsx 5 sheet: tổng quan, flash theo khung, voucher, quà, banner & nhắc. */
export async function campaignReportXlsx(r: CampaignReport): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ALOHA Shop";
  for (const s of sheetsOf(r)) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns;
    ws.getRow(1).font = { bold: true };
    for (const row of s.rows) ws.addRow(row);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
