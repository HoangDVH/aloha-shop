type CategoryProduct = { nhomPath?: string; nhom?: string; categoryName?: string; categorySlug?: string };
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/[-_]/g, " ");

export function isWholesaleHomeViewer(user: { roles: string[]; siStatus?: string | null; siRegion?: string | null } | null | undefined) {
  return Boolean(user?.roles.includes("si") && user.siStatus === "active" && (user.siRegion === "HCM" || user.siRegion === "TINH"));
}

export function wholesaleHomeHref(href: string, wholesale: boolean) {
  if (!wholesale || !href.startsWith("/tim?")) return href;
  const url = new URL(href, "https://shop.invalid");
  if (!["noi_bat", "uu_dai"].includes(url.searchParams.get("badge") || "")) return href;
  url.searchParams.set("homeOrder", "wholesale");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isFinishedPlantCategory(value: string) {
  const text = normalize(value);
  return text.includes("thanh pham trong san") || text.includes("thanh pham sale");
}

/** Preserve ranking/pins within each group; repeat two pots then one ordinary plant. */
export function orderWholesaleHomeProducts<T extends CategoryProduct>(items: T[]): T[] {
  const pots: T[] = [], plants: T[] = [], other: T[] = [], finished: T[] = [];
  for (const item of items) {
    const category = normalize([item.nhomPath, item.nhom, item.categoryName, item.categorySlug].filter(Boolean).join(" >> "));
    if (isFinishedPlantCategory(category)) finished.push(item);
    else if (category.includes("chau trong cay")) pots.push(item);
    else if (category.includes("cay canh du loai")) plants.push(item);
    else other.push(item);
  }
  const out: T[] = [];
  let p = 0, c = 0;
  while (p < pots.length || c < plants.length) {
    if (p < pots.length) out.push(pots[p++]);
    if (p < pots.length) out.push(pots[p++]);
    if (c < plants.length) out.push(plants[c++]);
  }
  return [...out, ...other, ...finished];
}
