import type { ShipSizeClass } from "./sizePresets.js";

const NHOM_RULES: { re: RegExp; size: ShipSizeClass }[] = [
  { re: /đất|giá thể|giath|dat\b|bao\s*\d/i, size: "dat_giath" },
  { re: /size\s*lớn|size\s*lon|\blớn\b|\blon\b| cỡ lớn/i, size: "to" },
  { re: /size\s*trung|\bvừa\b|\bvua\b| cỡ vừa/i, size: "vua" },
  { re: /size\s*nhỏ|size\s*nho|\bnhỏ\b|\bnho\b| cỡ nhỏ/i, size: "nho" },
  { re: /chậu\s*(lớn|lon|60|70|80|90)/i, size: "to" },
  { re: /chậu\s*(trung|vừa|40|50)/i, size: "vua" },
  { re: /chậu\s*(nhỏ|mini|15|20|25|30)/i, size: "nho" },
];

export function shipSizeFromCategory(nhomPath: string, ten = ""): ShipSizeClass | null {
  const hay = `${nhomPath} ${ten}`.trim();
  if (!hay) return null;
  for (const { re, size } of NHOM_RULES) {
    if (re.test(hay)) return size;
  }
  return null;
}
