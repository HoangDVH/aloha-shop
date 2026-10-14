// Keep release checks mandatory; local work can select just the affected group.
module.exports = {
  sharing: ["share-caption", "product-share-data", "share-capabilities"],
  vouchers: ["pdp-vouchers", "pdp-voucher-claim", "voucher-audience", "returning-voucher",
    "voucher-wallet", "voucher-price", "promotions-evaluator", "checkout-voucher-consistency", "ship-voucher"],
  recovery: ["client-recovery", "client-errors", "client-error-store"],
  "checkout-ui": ["checkout-total-display.test.cjs", "promotion-quote-freshness.test.cjs", "purchase-sheet.test.cjs"],
  release: ["client-recovery", "client-errors", "client-error-store", "voucher-audience",
    "returning-voucher", "voucher-wallet", "voucher-price", "promotions-evaluator",
    "checkout-voucher-consistency", "share-caption", "product-share-data", "share-capabilities",
    "pdp-vouchers", "pdp-voucher-claim", "checkout-total-display.test.cjs", "promotion-quote-freshness.test.cjs", "purchase-sheet.test.cjs"],
};
