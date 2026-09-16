import { SHOP_ORIGIN, absUrl } from "@/lib/seo";
import type { AppearanceTheme } from "@/lib/appearanceTypes";

/** Organization / LocalBusiness JSON-LD từ appearance footer. */
export function buildLocalBusinessJsonLd(theme: AppearanceTheme) {
  const name = theme.siteName?.trim() || "ALOHA Thế Giới Chậu Cây";
  const phone = theme.footer?.phone?.trim() || "";
  const email = theme.footer?.email?.trim() || "";
  const address = theme.footer?.address?.trim() || "";
  const logo = absUrl(theme.logoUrl || "/brand/logo-aloha.png");

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url: SHOP_ORIGIN,
    image: logo,
    logo,
    telephone: phone || undefined,
    email: email || undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
          addressLocality: "Hồ Chí Minh",
          addressCountry: "VN",
        }
      : undefined,
  };
}

export function buildBreadcrumbJsonLd(
  items: { name: string; path: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SHOP_ORIGIN}${it.path.startsWith("/") ? it.path : `/${it.path}`}`,
    })),
  };
}
