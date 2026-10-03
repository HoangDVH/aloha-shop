import type { CampaignPhase, CampaignSlotUI, FlashStageText } from "./campaignApi";
import { currentSlotKey } from "./slotClock";

/** Flash Sale giữ một tông đỏ cố định như các sàn, không đổi theo màu chiến dịch; cả dải đủ tương phản chữ trắng. */
export const FLASH_STAGE_BG = "linear-gradient(90deg, #A8141F 0%, #CE2D37 55%, #C93A2A 100%)";

export const FLASH_STAGE_DEFAULT: FlashStageText = {
  title: "SÂN KHẤU FLASH SALE ĐẠI LỄ",
  badge: "GIÁ SỐC NHẤT NĂM",
  subtitle: "Số lượng có hạn, làm mới mỗi khung giờ - Cam kết cây tươi nguyên bản",
};

export type SlotTemplate = { id: string; label: string; hint: string; slots: CampaignSlotUI[] };

const slot = (start: string, end: string, overnight?: boolean): CampaignSlotUI => ({
  key: `S${Number(start.slice(0, 2))}`,
  start,
  end,
  ...(overnight ? { overnight } : {}),
});

/** Mẫu khung giờ theo cách các sàn TMĐT hay chạy Flash Sale. */
export const SLOT_TEMPLATES: SlotTemplate[] = [
  {
    id: "san-6",
    label: "6 khung liên tục (kiểu Shopee)",
    hint: "0h · 9h · 12h · 15h · 18h · 21h, khung này nối khung kia cả ngày",
    slots: [
      slot("00:00", "09:00"),
      slot("09:00", "12:00"),
      slot("12:00", "15:00"),
      slot("15:00", "18:00"),
      slot("18:00", "21:00"),
      slot("21:00", "00:00", true),
    ],
  },
  {
    id: "vang-4",
    label: "4 khung giờ vàng",
    hint: "9h · 12h · 16h · 20h, mỗi khung 2 tiếng",
    slots: [slot("09:00", "11:00"), slot("12:00", "14:00"), slot("16:00", "18:00"), slot("20:00", "22:00")],
  },
  {
    id: "trua-toi-2",
    label: "2 khung trưa – tối",
    hint: "12h · 20h, mỗi khung 2 tiếng",
    slots: [slot("12:00", "14:00"), slot("20:00", "22:00")],
  },
];

export const slotRangeText = (s: CampaignSlotUI) => `${s.start}–${s.end}`;

/** Lựa chọn khung giờ cho ô chọn ở admin; "" = cả ngày. */
export function slotOptions(slots: CampaignSlotUI[]): { value: string; label: string }[] {
  return [
    { value: "", label: "Cả ngày (toàn chiến dịch)" },
    ...slots.map((s) => ({ value: s.key, label: `${slotRangeText(s)}${s.label?.trim() ? ` · ${s.label.trim()}` : ""}` })),
  ];
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export type StageChip = { key: string; time: string; status: "open" | "next" | "tomorrow"; text: string; label: string };

const STATUS_TEXT: Record<StageChip["status"], string> = {
  open: "Đang diễn ra",
  next: "Sắp diễn ra",
  tomorrow: "Ngày mai",
};

/**
 * Thứ tự kiểu sàn TMĐT: khung đang mở → các khung sắp tới trong ngày → khung đã qua (ngày mai).
 * Dòng dưới giờ luôn là trạng thái theo giờ hiện tại; nhãn admin đặt nằm ở `label` (tooltip, trang ưu đãi).
 */
export function stageChips(slots: CampaignSlotUI[], phase: CampaignPhase, nowMs: number, endAtMs: number): StageChip[] {
  const selling = phase === "live" || phase === "lastHours";
  const openKey = selling ? currentSlotKey(slots, nowMs) : null;
  const vn = new Date(nowMs + 7 * 3600_000);
  const mins = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  const msUntil = (s: CampaignSlotUI) => {
    const diff = toMin(s.start) - mins;
    return (diff > 0 ? diff : diff + 1440) * 60_000;
  };
  return [...slots]
    .map((s) => {
      const status: StageChip["status"] =
        s.key === openKey ? "open" : !selling || toMin(s.start) > mins ? "next" : "tomorrow";
      return { s, status, order: s.key === openKey ? -1 : msUntil(s) };
    })
    .filter(({ s, status }) => status !== "tomorrow" || nowMs + msUntil(s) < endAtMs)
    .sort((a, b) => a.order - b.order)
    .map(({ s, status }) => ({
      key: s.key,
      time: s.start,
      status,
      text: STATUS_TEXT[status],
      label: s.label?.trim() || "",
    }));
}
