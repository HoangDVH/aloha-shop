import type { ShopProductAttr } from "./api";

/** Chuỗi biến thể kiểu TikTok: "Xám Trắng, L" hoặc "CÂY". */
export function formatVariantLabel(input: {
  attributes?: ShopProductAttr[] | null;
  dvt?: string | null;
}): string {
  const vals = (input.attributes || [])
    .map((a) => String(a?.attributeValue || "").trim())
    .filter(Boolean);
  if (vals.length) return vals.join(", ");
  const dvt = String(input.dvt || "").trim();
  if (dvt && dvt.toLowerCase() !== "cái") return dvt;
  return "";
}

export function normalizeCartAttributes(
  raw: unknown
): ShopProductAttr[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: ShopProductAttr[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const attributeName = String(
      o.attributeName || o.name || ""
    ).trim();
    const attributeValue = String(
      o.attributeValue || o.value || ""
    ).trim();
    if (!attributeName && !attributeValue) continue;
    out.push({ attributeName, attributeValue });
  }
  return out.length ? out : undefined;
}
