export type ShopBankInfo = {
  bin: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  ttlMin: number;
  configured: boolean;
};

export function buildVietQrUrl(opts: {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  addInfo: string;
}): string {
  const amount = Math.max(0, Math.round(Number(opts.amount) || 0));
  const addInfo = encodeURIComponent(String(opts.addInfo || "").trim().slice(0, 25));
  const name = encodeURIComponent(String(opts.accountName || "").trim().slice(0, 50));
  return `https://img.vietqr.io/image/${opts.bin}-${opts.accountNumber}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${name}`;
}

export async function fetchShopBank(): Promise<ShopBankInfo | null> {
  try {
    const res = await fetch("/api/shop/payments/bank", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return (data as { data?: ShopBankInfo }).data || null;
  } catch {
    return null;
  }
}
