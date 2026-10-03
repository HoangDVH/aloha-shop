/**
 * Bật dần: SHOP_CAMPAIGN_ENABLED → SHOP_VOUCHER_WALLET_ENABLED → SHOP_FLASH_SALE_ENABLED.
 * Mặc định tắt; ví và flash sale chỉ chạy khi chiến dịch đã bật.
 */
function envOn(name: string): boolean {
  const v = String(process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const campaignEnabled = () => envOn("SHOP_CAMPAIGN_ENABLED");
export const voucherWalletEnabled = () => campaignEnabled() && envOn("SHOP_VOUCHER_WALLET_ENABLED");

/** Worker nhả suất treo / đối soát bộ đếm; tắt bằng SHOP_CAMPAIGN_WORKER=0. */
export const campaignWorkerEnabled = () => String(process.env.SHOP_CAMPAIGN_WORKER ?? "").trim() !== "0";

/** Production không bán giá flash khi worker tắt (suất treo sẽ không ai nhả). */
export const flashSaleEnabled = () =>
  campaignEnabled() &&
  envOn("SHOP_FLASH_SALE_ENABLED") &&
  (campaignWorkerEnabled() || process.env.NODE_ENV !== "production");
