type VolumeSavingLine = {
  price: number;
  quantity: number;
  isGift?: boolean;
  flash?: { listPrice: number };
  volumePricing?: { basePrice: number };
};

/** The volume discount precedes Flash Sale; gifts never contribute savings. */
export function volumeSavingsForLines(lines: VolumeSavingLine[]): number {
  return lines.reduce((sum, line) => sum + (line.isGift || !line.volumePricing ? 0 :
    Math.max(0, line.volumePricing.basePrice - (line.flash?.listPrice ?? line.price)) * line.quantity), 0);
}
