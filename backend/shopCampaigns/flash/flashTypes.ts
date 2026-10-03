/** Suất giá sale đang mở cho 1 mã, đọc từ bộ đếm tại thời điểm báo giá / tạo đơn. */
export type FlashOffer = {
  campaignId: string;
  ma: string;
  salePrice: number;
  counterId: string;
  quota: number;
  perCustomerLimit: number;
  /** quota − sold − held (không âm). */
  remaining: number;
  /** Giới hạn mỗi khách còn lại (đã trừ đơn chưa huỷ). */
  customerRemaining: number;
};

/** Gắn vào dòng đơn được tính giá sale. */
export type FlashLineMeta = {
  campaignId: string;
  counterId: string;
  listPrice: number;
  salePrice: number;
};

/** Quà 0đ server tạo; client không tự gửi được. */
export type GiftLineMeta = {
  campaignId: string;
  counterId: string;
  giftFor: string;
};

export type FlashHold = { counterId: string; qty: number; customerIds: string[] };
export type GiftHold = { counterId: string; qty: number };

/**
 * Suất và quà đơn đang giữ; lưu trong chính đơn hàng. Chuyển trạng thái bằng update có điều kiện
 * `state: "held"` nên thanh toán / huỷ gọi lặp cũng chỉ cập nhật bộ đếm 1 lần.
 */
export type CampaignHolds = {
  campaignId: string;
  state: "held" | "sold" | "released";
  flash: FlashHold[];
  gifts: GiftHold[];
  heldAt: string;
  settledAt?: string;
  /** Thao tác chốt / nhả đang dở; xong thì xoá (xem settleOperation.ts). */
  op?: HoldOperation;
};

export type HoldOperation = { id: string; target: "sold" | "released"; phase: "apply" | "cleanup"; startedAt: string };

export const FLASH_MESSAGES = {
  slotEnded: "Khung giờ vàng đã kết thúc, giá đã về giá thường.",
  soldOut: "Suất giá sale vừa hết, giá đã về giá thường.",
  partial: (name: string, n: number) => `${name}: chỉ ${n} sản phẩm được giá sale, phần còn lại tính giá thường.`,
  limitReached: (name: string, limit: number) =>
    `${name}: bạn đã mua đủ ${limit} sản phẩm giá sale trong khung giờ này, phần còn lại tính giá thường.`,
  giftLimited: (name: string, n: number) => `Quà "${name}" chỉ còn ${n} phần.`,
  giftOut: (name: string) => `Quà "${name}" đã hết, các quà khác vẫn được tặng.`,
} as const;
