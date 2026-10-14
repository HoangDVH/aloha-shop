// Keep release checks mandatory; local work can select just the affected group.
module.exports = {
  sharing: ["share-caption", "public-share-preview", "product-share-data", "share-capabilities"],
  vouchers: ["pdp-vouchers", "pdp-voucher-claim", "voucher-audience", "returning-voucher",
    "voucher-wallet", "voucher-price", "promotions-evaluator", "checkout-voucher-consistency", "ship-voucher"],
  recovery: ["client-recovery", "client-errors", "client-error-store"],
  "checkout-ui": ["checkout-total-display.test.cjs", "promotion-quote-freshness.test.cjs", "purchase-sheet.test.cjs"],
  gallery: ["product-gallery.test.cjs"],
  "voucher-scope": ["voucher-scope-consistency", "voucher-product-filter", "pdp-vouchers", "share-caption"],
  release: ["client-recovery", "client-errors", "client-error-store", "voucher-audience",
    "returning-voucher", "voucher-wallet", "voucher-price", "promotions-evaluator",
    "checkout-voucher-consistency", "share-caption", "public-share-preview", "product-share-data", "share-capabilities",
    "pdp-vouchers", "pdp-voucher-claim", "checkout-total-display.test.cjs", "promotion-quote-freshness.test.cjs", "purchase-sheet.test.cjs", "product-gallery.test.cjs",
    "voucher-scope-consistency", "voucher-product-filter"],
};
