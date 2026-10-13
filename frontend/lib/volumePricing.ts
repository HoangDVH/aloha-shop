export type VolumePricingTier = {
  minQty: number;
  maxQty?: number;
  discountPercent: number;
  label: string;
  badge?: string;
  highlight?: boolean;
};

export const DEFAULT_VOLUME_TIERS: VolumePricingTier[] = [
  {
    minQty: 1,
    maxQty: 4,
    discountPercent: 0,
    label: "1 – 4",
    badge: "Giá lẻ",
  },
  {
    minQty: 5,
    maxQty: 9,
    discountPercent: 5,
    label: "5 – 9",
    badge: "Giảm 5%",
  },
  {
    minQty: 10,
    discountPercent: 10,
    label: "≥ 10",
    badge: "Giảm 10%",
    highlight: true,
  },
];

export function getVolumeTier(qty: number, tiers = DEFAULT_VOLUME_TIERS): VolumePricingTier {
  const q = Math.max(1, Math.floor(qty));
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (q >= tiers[i].minQty) {
      return tiers[i];
    }
  }
  return tiers[0];
}

export function calculateTierPrice(
  basePrice: number,
  qty: number,
  tiers = DEFAULT_VOLUME_TIERS
): {
  tier: VolumePricingTier;
  unitPrice: number;
  originalSubtotal: number;
  discountedSubtotal: number;
  savedAmount: number;
  unitSaving: number;
  nextTier: VolumePricingTier | null;
  itemsToNextTier: number;
} {
  const currentTier = getVolumeTier(qty, tiers);
  const discountRate = currentTier.discountPercent / 100;
  const unitPrice = Math.round(basePrice * (1 - discountRate));
  const originalSubtotal = basePrice * qty;
  const discountedSubtotal = unitPrice * qty;
  const savedAmount = Math.max(0, originalSubtotal - discountedSubtotal);
  const unitSaving = Math.max(0, basePrice - unitPrice);

  const currentIndex = tiers.findIndex((t) => t.minQty === currentTier.minQty);
  const nextTier =
    currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  const itemsToNextTier = nextTier ? Math.max(0, nextTier.minQty - qty) : 0;

  return {
    tier: currentTier,
    unitPrice,
    originalSubtotal,
    discountedSubtotal,
    savedAmount,
    unitSaving,
    nextTier,
    itemsToNextTier,
  };
}
