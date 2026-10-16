/** Positions shown to staff are one-based. Invalid input leaves the order intact. */
export function moveGiftProduct(codes: string[], code: string, position: number): string[] {
  const index = codes.indexOf(code);
  if (index < 0 || !Number.isInteger(position)) return codes;
  const target = Math.max(0, Math.min(codes.length - 1, position - 1));
  if (index === target) return codes;
  const next = codes.filter(item => item !== code);
  next.splice(target, 0, code);
  return next;
}

export function insertGiftProduct(codes: string[], code: string, position: number): string[] {
  if (!code || codes.includes(code) || codes.length >= 100 || !Number.isInteger(position)) return codes;
  const next = [...codes];
  next.splice(Math.max(0, Math.min(codes.length, position - 1)), 0, code);
  return next;
}

export function giftProductPage(codes: string[], requestedPage: number, pageSize: number) {
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 5;
  const page = Math.max(1, Math.min(Math.ceil(codes.length / size) || 1, Math.trunc(requestedPage) || 1));
  const start = (page - 1) * size;
  return { page, start, codes: codes.slice(start, start + size) };
}
