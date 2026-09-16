import { buildLocalBusinessJsonLd } from "@/lib/seoSchema";
import type { AppearanceTheme } from "@/lib/appearanceTypes";

export function OrgJsonLd({ theme }: { theme: AppearanceTheme }) {
  if (theme.seo?.enableOrgJsonLd === false) return null;
  const data = buildLocalBusinessJsonLd(theme);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
