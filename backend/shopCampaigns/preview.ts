import jwt from "jsonwebtoken";
import { shopQuoteSecret } from "../shopAuth/tokens.js";

const TYP = "campaign_preview";
export const PREVIEW_TTL_SEC = 30 * 60;

/** Khoá riêng cho link xem trước: lộ token báo giá không mở được bản nháp và ngược lại. */
const secret = () => `${shopQuoteSecret()}:${TYP}`;

export function signPreviewToken(campaignId: string, actor: string): string {
  return jwt.sign({ typ: TYP, cid: campaignId, by: actor }, secret(), { expiresIn: PREVIEW_TTL_SEC });
}

/** null khi token hết hạn, bị sửa, hoặc không phải token xem trước. */
export function verifyPreviewToken(token: string): { cid: string } | null {
  try {
    const p = jwt.verify(String(token || ""), secret()) as { typ?: string; cid?: string };
    return p?.typ === TYP && typeof p.cid === "string" && p.cid ? { cid: p.cid } : null;
  } catch {
    return null;
  }
}
