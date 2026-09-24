import { createHash } from "node:crypto";
import type { Collection, Document } from "mongodb";
import { mergeCartLines, normalizeCartLines, type CartLineDoc } from "./models.js";

// Receipts and cart lines share one document: no transaction/replica set required.
const MERGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RECEIPTS = 512;
export class CartWriteError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function cartPayload(row: Document | null, userId: string) {
  return { ok: true, userId, lines: normalizeCartLines(row?.lines),
    revision: Number(row?.revision) || 0,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : new Date(0).toISOString() };
}

async function ensureCart(carts: Collection, userId: string) {
  try {
    await carts.updateOne({ userId }, { $setOnInsert: {
      userId, lines: [], revision: 0, mergeReceipts: [], createdAt: new Date(), updatedAt: new Date(0),
    } }, { upsert: true });
  } catch (error: any) {
    if (error.code !== 11000) throw error; // Another worker created this user's cart.
  }
}

function versionFilter(row: Document) {
  return { _id: row._id, revision: row.revision === undefined ? { $exists: false } : row.revision };
}

export async function saveCart(carts: Collection, userId: string, lines: CartLineDoc[], revision: unknown) {
  if (!Number.isSafeInteger(revision) || Number(revision) < 0) {
    throw new CartWriteError(428, "cart_revision_required", "Vui lòng tải lại giỏ hàng trước khi lưu.");
  }
  await ensureCart(carts, userId);
  const row = await carts.findOne({ userId });
  if (!row || (Number(row.revision) || 0) !== revision) throw conflict();
  const updatedAt = new Date();
  const nextRevision = Number(revision) + 1;
  const result = await carts.updateOne(versionFilter(row), { $set: { lines, updatedAt, revision: nextRevision } });
  if (!result.matchedCount) throw conflict();
  return cartPayload({ lines, updatedAt, revision: nextRevision }, userId);
}

function conflict() {
  return new CartWriteError(409, "cart_conflict", "Giỏ hàng đã thay đổi ở nơi khác. Đã tải lại giỏ mới nhất; vui lòng kiểm tra lại.");
}

export async function mergeCart(carts: Collection, userId: string, guest: CartLineDoc[], key: unknown) {
  const now = Date.now();
  const match = typeof key === "string" && /^(\d{13})\.([a-f0-9-]{36})$/.exec(key);
  if (!match) throw new CartWriteError(400, "merge_key_required", "Thiếu mã đồng bộ giỏ hàng. Vui lòng tải lại trang.");
  const issuedAt = Number(match[1]);
  if (issuedAt < now - MERGE_WINDOW_MS || issuedAt > now + 5 * 60 * 1000) {
    throw new CartWriteError(409, "merge_expired", "Lần đồng bộ giỏ đã hết hạn. Vui lòng liên hệ Aloha để kiểm tra giỏ hàng.");
  }
  const fingerprint = createHash("sha256").update(JSON.stringify([...guest].sort((a, b) => a.ma.localeCompare(b.ma)))).digest("hex");
  await ensureCart(carts, userId);
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await carts.findOne({ userId });
    if (!row) throw conflict();
    const receipts: Array<{ key: string; fingerprint: string; issuedAt: number }> = row.mergeReceipts || [];
    const previous = receipts.find(receipt => receipt.key === key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new CartWriteError(409, "merge_key_reused", "Mã đồng bộ đã được dùng cho giỏ khác.");
      // Return current cart, never overwrite subsequent edits with an old snapshot.
      return { ...cartPayload(row, userId), reused: true };
    }
    const retained = receipts.filter(receipt => receipt.issuedAt >= now - MERGE_WINDOW_MS);
    if (retained.length >= MAX_RECEIPTS) throw new CartWriteError(429, "merge_limit", "Quá nhiều lần đồng bộ giỏ. Vui lòng thử lại sau.");
    const lines = mergeCartLines(normalizeCartLines(row.lines), guest);
    const updatedAt = new Date();
    const revision = (Number(row.revision) || 0) + 1;
    const result = await carts.updateOne(versionFilter(row), { $set: {
      lines, updatedAt, revision,
      mergeReceipts: [...retained, { key: key as string, fingerprint, issuedAt }],
    } });
    if (result.matchedCount) return { ...cartPayload({ lines, updatedAt, revision }, userId), reused: false };
  }
  throw conflict();
}
