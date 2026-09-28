import type { Db } from "mongodb";
import {
  requireAuth,
  requireActive,
  requireManager,
  type AuthRequest,
  type GetDb,
} from "../../auth/middleware.js";
import type { GetShopDb } from "../routes.js";
import { ensureCommissionIndexes } from "../commissionModels.js";

export type { GetDb, GetShopDb, AuthRequest };

export type CommissionAdminCtx = {
  getDb: GetDb;
  getShopDb: GetShopDb;
  gate: any[];
  ensure: (db: Db) => Promise<void>;
};

export function buildCommissionAdminCtx(
  getDb: GetDb,
  getShopDb: GetShopDb
): CommissionAdminCtx {
  const gate = [requireAuth(getDb), requireActive, requireManager];
  let ready = false;
  const ensure = async (db: Db) => {
    if (ready) return;
    await ensureCommissionIndexes(db);
    ready = true;
  };
  return { getDb, getShopDb, gate, ensure };
}

/**
 * Regex khớp tên/mã không phân biệt dấu tiếng Việt (giống Hàng hóa).
 * Gõ «kim tien» vẫn ra «Kim Tiền».
 */
export function vietLooseRegexSource(raw: string): string {
  const foldMap: Record<string, string> = {
    a: "[aàáảãạăằắẳẵặâầấẩẫậAÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]",
    e: "[eèéẻẽẹêềếểễệEÈÉẺẼẸÊỀẾỂỄỆ]",
    i: "[iìíỉĩịIÌÍỈĨỊ]",
    o: "[oòóỏõọôồốổỗộơờớởỡợOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]",
    u: "[uùúủũụưừứửữựUÙÚỦŨỤƯỪỨỬỮỰ]",
    y: "[yỳýỷỹỵYỲÝỶỸỴ]",
    d: "[dđDĐ]",
  };
  const s = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  let out = "";
  for (const ch of s) {
    if (foldMap[ch]) out += foldMap[ch];
    else if (/[.*+?^${}()|[\]\\]/.test(ch)) out += "\\" + ch;
    else out += ch;
  }
  return out;
}
