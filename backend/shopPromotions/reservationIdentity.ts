import { createHash } from 'node:crypto';
import type { PromotionRedemptionDoc } from './types.js';

export type ReservationInput = Pick<PromotionRedemptionDoc, 'promotionId' | 'orderCode' | 'discountAmount'> &
  Partial<Pick<PromotionRedemptionDoc, 'buyerId' | 'buyerPhone' | 'buyerEmail' | 'customerKey' | 'promotionCode' | 'benefitType' | 'idempotencyKey'>>;

export function reservationLookup(input: ReservationInput) {
  return { promotionId: input.promotionId, $or: [
    { orderCode: input.orderCode },
    ...(input.idempotencyKey && input.buyerId ? [{ buyerId: input.buyerId, idempotencyKey: input.idempotencyKey }] : []),
  ] };
}

/** Deterministic ID makes concurrent inserts contend on MongoDB's unique _id. */
export function reservationId(input: ReservationInput): string {
  const key = input.idempotencyKey && input.buyerId
    ? ['buyer-key', input.promotionId, input.buyerId, input.idempotencyKey]
    : ['order', input.promotionId, input.orderCode];
  return `rsv_${createHash('sha256').update(JSON.stringify(key)).digest('hex')}`;
}

export function reservationReplay(existing: PromotionRedemptionDoc, input: ReservationInput):
  { ok: true; redemptionId: string } | { ok: false; error: string } {
  const ownerMatches = input.buyerId
    ? existing.buyerId === input.buyerId || (!existing.buyerId && existing.customerKey === `acc:${input.buyerId}`)
    : !existing.buyerId && !existing.customerKey && existing.buyerPhone === input.buyerPhone && existing.buyerEmail === input.buyerEmail;
  if (!ownerMatches || existing.orderCode !== input.orderCode || existing.discountAmount !== input.discountAmount ||
    (existing.promotionCode || '') !== String(input.promotionCode || '').trim().toUpperCase() ||
    (existing.benefitType || 'goods') !== (input.benefitType || 'goods') ||
    (existing.idempotencyKey || '') !== (input.idempotencyKey || '') ||
    !['held', 'used'].includes(existing.status)) {
    return { ok: false, error: 'Yêu cầu giữ voucher không khớp người mua, đơn hàng hoặc nội dung đã gửi. Vui lòng tải lại báo giá.' };
  }
  return { ok: true, redemptionId: String(existing.id || (existing as any)._id) };
}
