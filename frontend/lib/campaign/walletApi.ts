export type WalletItemState = "usable" | "held" | "upcoming" | "paused" | "locked" | "used" | "expired";

export type WalletVoucherUI = {
  id: string;
  title: string;
  description: string;
  benefitType: "goods" | "shipping";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  targetCustomer?: string;
  startDate?: string;
  endDate?: string;
};

export type WalletItemUI = {
  promotionId: string;
  state: WalletItemState;
  tab: "active" | "used" | "expired";
  orderCode: string | null;
  returnedFrom?: { orderCode: string; reason: "cancelled" | "expired" } | null;
  savedAt: string;
  usedAt: string | null;
  voucher: WalletVoucherUI | null;
};

export type WalletResponse = {
  ok: boolean;
  enabled: boolean;
  loggedIn?: boolean;
  items: WalletItemUI[];
  counts?: { active: number; used: number; expired: number };
  claimedIds: string[];
};

export type ClaimFailCode =
  | "retail_only"
  | "account_locked"
  | "login_required"
  | "not_found"
  | "claim_not_started"
  | "expired"
  | "not_eligible"
  | "claim_limit"
  | "wallet_disabled"
  | "network";

export type ClaimResponse =
  | { ok: true; already: boolean; promotionId: string; message: string }
  | { ok: false; code: ClaimFailCode; error: string; promotionId: string };

export type ClaimBatchResponse =
  | { ok: true; saved: number; total: number; skipped: number; message: string; results: ClaimResponse[] }
  | { ok: false; code: ClaimFailCode; error: string };

const EMPTY_WALLET: WalletResponse = { ok: true, enabled: false, items: [], claimedIds: [] };

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  } catch {
    return { ok: false, code: "network", error: "Mất kết nối, vui lòng thử lại." } as T;
  }
}

export async function fetchWallet(): Promise<WalletResponse> {
  try {
    const res = await fetch("/api/shop/vouchers/wallet", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_WALLET;
    return { ...EMPTY_WALLET, ...((await res.json()) as WalletResponse) };
  } catch {
    return EMPTY_WALLET;
  }
}

export function claimVoucher(promotionId: string): Promise<ClaimResponse> {
  return postJson<ClaimResponse>("/api/shop/vouchers/claim", { promotionId });
}

export function claimAllVouchers(idempotencyKey: string): Promise<ClaimBatchResponse> {
  return postJson<ClaimBatchResponse>("/api/shop/vouchers/claim-batch", {}, { "Idempotency-Key": idempotencyKey });
}

/** Việc khách định làm trước khi bị hỏi đăng nhập — đăng nhập xong (kể cả qua Google) tự làm tiếp. */
export type PendingIntent = { type: "claim"; promotionId: string } | { type: "claimAll" };

const INTENT_KEY = "aloha-campaign-intent";

export function setPendingIntent(intent: PendingIntent): void {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, at: Date.now() }));
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
}

/** Lấy và xoá ý định; quá 15 phút thì bỏ để không tự lưu bất ngờ. */
export function takePendingIntent(): PendingIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(INTENT_KEY);
    const v = JSON.parse(raw) as PendingIntent & { at?: number };
    if (!v.at || Date.now() - v.at > 15 * 60_000) return null;
    if (v.type === "claim" && typeof v.promotionId === "string") return { type: "claim", promotionId: v.promotionId };
    if (v.type === "claimAll") return { type: "claimAll" };
    return null;
  } catch {
    return null;
  }
}
