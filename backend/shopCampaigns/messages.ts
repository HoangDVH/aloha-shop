import type { CampaignErrorCode } from "./types.js";

/** Câu hiển thị cho khách theo mã lỗi thống nhất. */
export const CAMPAIGN_ERROR_MESSAGES: Record<CampaignErrorCode, string> = {
  retail_only: "Ưu đãi này dành cho khách lẻ.",
  sold_out: "Suất giá sale đã hết.",
  claim_limit: "Voucher đã hết lượt.",
  not_claimed: "Bạn cần lưu voucher trước khi dùng.",
  price_changed: "Giá vừa thay đổi, vui lòng kiểm tra lại đơn hàng.",
  campaign_paused: "Chương trình ưu đãi đang tạm dừng.",
};

export const CAMPAIGN_ADMIN_MESSAGES = {
  notFound: "Không tìm thấy chiến dịch.",
  revisionConflict: "Chiến dịch vừa được người khác sửa. Vui lòng tải lại trang.",
  invalid: "Thông tin chiến dịch chưa hợp lệ, xem các ô báo đỏ.",
  overlap: (name: string) => `Trùng thời gian với chiến dịch "${name}". Mỗi lúc chỉ chạy 1 chiến dịch.`,
  nothingPublished: "Chiến dịch chưa từng được bật.",
  hasOrders: "Chiến dịch đã có đơn hàng nên không xoá được, chỉ lưu trữ.",
  onlyDraftDelete: "Chỉ xoá được chiến dịch chưa bật lần nào.",
  scheduleInPast: "Giờ hẹn bật phải ở tương lai.",
  locked: "Tài khoản đang bị khoá, không dùng được ưu đãi.",
  needsConfirm: "Có sản phẩm bán dưới giá vốn. Quản lý cần xác nhận lần 2 và nhập lý do (ít nhất 5 ký tự).",
  managerOnly: "Chỉ quản lý được sửa giá, số lượng, quà và voucher của chiến dịch.",
  quotaBelowUsed: (ma: string, used: number, quota: number) =>
    `${ma}: đã bán + đang giữ ${used} suất, không giảm số lượng xuống ${quota} được.`,
} as const;

export function campaignErrorBody(code: CampaignErrorCode, extra: Record<string, unknown> = {}) {
  return { ok: false, code, error: CAMPAIGN_ERROR_MESSAGES[code], ...extra };
}
