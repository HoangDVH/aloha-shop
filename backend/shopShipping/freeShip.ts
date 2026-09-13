/**
 * Free ship:
 * 1) Đơn đạt tối thiểu SHOP_FREE_SHIP_MIN_VND (nếu > 0)
 * 2) Mọi dòng hàng có đơn giá < SHOP_FREE_SHIP_MAX_UNIT_VND (mặc định 10000)
 */
export function freeShipMinVnd(): number {
  return Math.max(0, Number(process.env.SHOP_FREE_SHIP_MIN_VND || 0) || 0);
}

/** Đơn giá dưới mức này → free ship (mặc định 10.000đ). Đặt 0 để tắt. */
export function freeShipMaxUnitVnd(): number {
  const raw = process.env.SHOP_FREE_SHIP_MAX_UNIT_VND;
  if (raw === undefined || raw === "") return 10_000;
  return Math.max(0, Number(raw) || 0);
}

export function qualifiesFreeShip(
  subtotal: number,
  items?: Array<{ price?: number; quantity?: number }>
): boolean {
  const min = freeShipMinVnd();
  if (min > 0 && subtotal >= min) return true;

  const maxUnit = freeShipMaxUnitVnd();
  if (maxUnit > 0 && Array.isArray(items) && items.length > 0) {
    // Gồm cả giá 0đ — trước đó `price > 0` làm SP 0đ không được free ship
    const allCheap = items.every((it) => {
      const price = Math.max(0, Number(it?.price) || 0);
      return price < maxUnit;
    });
    if (allCheap) return true;
  }

  return false;
}
