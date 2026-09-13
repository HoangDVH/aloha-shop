/** Bật/tắt overlay loading toàn trang (logo ALOHA) — dùng khi fetch hoặc thao tác đổi dữ liệu. */
export function startShopLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("shop:loading-start"));
}

export function stopShopLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("shop:loading-end"));
}

/** Báo chuyển trang (Link / router.push) — cùng overlay với loading dữ liệu. */
export function notifyShopNavStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("shop:nav-start"));
}
