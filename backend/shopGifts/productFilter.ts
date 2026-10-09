import { z } from "zod";
import type { Db } from "mongodb";
import { listActiveGifts } from "./giftRepo.js";
import type { GiftCollectionItem } from "./types.js";
const giftQuerySchema = z.enum(["nguoi-thuong", "gia-dinh", "khai-truong", "ban-lam-viec"]);
export function parseGiftQuery(value: unknown): string | null {
  const parsed = giftQuerySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function giftProductCodes(gifts: GiftCollectionItem[], recipient: string): string[] {
  return [...new Set(gifts.filter(gift => gift.isActive && gift.recipientType === recipient)
    .flatMap(gift => gift.linkedProductCodes || []).map(code => code.trim()).filter(Boolean))].sort();
}
export async function loadGiftFilterCodes(db: Db, recipient: string): Promise<string[]> {
  return giftProductCodes(await listActiveGifts(db), recipient);
}
