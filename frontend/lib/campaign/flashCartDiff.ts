type QuoteLines = { lines: { ma: string; flash?: boolean; isGift?: boolean }[] };

export function flashMas(campaign: QuoteLines): Set<string> {
  return new Set(campaign.lines.filter((l) => l.flash).map((l) => l.ma));
}

/** Mã trước đó có giá sale, nay vẫn còn trong giỏ nhưng không còn dòng giá sale (bỏ khỏi giỏ thì không tính). */
export function droppedFlashMas(prev: Set<string>, campaign: QuoteLines): string[] {
  const now = flashMas(campaign);
  const inCart = new Set(campaign.lines.filter((l) => !l.isGift).map((l) => l.ma));
  return [...prev].filter((ma) => inCart.has(ma) && !now.has(ma));
}
