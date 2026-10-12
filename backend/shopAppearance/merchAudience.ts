import { z } from "zod";
import type { Db } from "mongodb";

const indexes = new WeakMap<Db, Promise<unknown>>();
export async function ensureSiMerchIndexes(db: Db) {
  let pending = indexes.get(db);
  if (!pending) {
    pending = db.collection("aloha_products").createIndexes([
      { key: { webSiFeatured: 1, webSiFeaturedPin: 1 }, name: "si_home_featured" },
      { key: { webSiDeals: 1, webSiDealsPin: 1 }, name: "si_home_deals" },
    ]).catch(error => { indexes.delete(db); throw error; });
    indexes.set(db, pending);
  }
  await pending;
}

export const merchAudienceSchema = z.enum(["common", "si_noi_bat", "si_uu_dai"]);
export type MerchAudience = z.infer<typeof merchAudienceSchema>;
export function merchFields(audience: MerchAudience) {
  if (audience === "si_noi_bat") return { badge: "webSiFeatured", pin: "webSiFeaturedPin", label: "noi_bat" };
  if (audience === "si_uu_dai") return { badge: "webSiDeals", pin: "webSiDealsPin", label: "uu_dai" };
  return { badge: "webBadge", pin: "webPin", label: "" };
}
export function merchBadge(doc: Record<string, unknown>, audience: MerchAudience) {
  const fields = merchFields(audience);
  return audience === "common" ? String(doc.webBadge || "") : doc[fields.badge] === true ? fields.label : "";
}

/** Maps a selected private list to the existing ranking/card fields without editing documents. */
export function overlaySiMerch<T extends Record<string, unknown>>(docs: T[], badge: string): T[] {
  const fields = merchFields(badge === "noi_bat" ? "si_noi_bat" : "si_uu_dai");
  return docs.map(doc => ({ ...doc, webBadge: fields.label, webPin: doc[fields.pin] || 0 }));
}
