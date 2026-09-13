/** Sau Xuất bản: reload iframe preview shop trong tab Tổng quan (nếu đang mở). */
export function reloadShopPreviewIframes() {
  try {
    document.querySelectorAll("iframe").forEach((el) => {
      const iframe = el as HTMLIFrameElement;
      const src = String(iframe.src || "");
      if (!src || src.includes("kiotviet") || src.includes("/man/")) return;
      const isShopPreview =
        src.includes(":3002") ||
        src.includes("localhost:3002") ||
        /^https?:\/\/(www\.)?alohathegioichaucay\.com\/?(\?.*)?$/i.test(src);
      if (!isShopPreview) return;
      try {
        iframe.contentWindow?.location.reload();
      } catch {
        iframe.src = src;
      }
    });
  } catch {
    /* ignore */
  }
}
