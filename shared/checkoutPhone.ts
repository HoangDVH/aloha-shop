/** Checkout accepts Vietnamese mobiles and landlines, including +84 and common display separators. */
export function isValidCheckoutPhone(value: string): boolean {
  const raw = value.trim();
  if (raw.length > 20) return false;
  const phone = raw.replace(/[\s().-]/g, "");
  return /^(?:0[35789]\d{8}|02\d{9}|\+?84(?:[35789]\d{8}|2\d{9}))$/.test(phone);
}
