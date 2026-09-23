import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ThemeCssServer } from "@/components/ThemeCssServer";
import { OrgJsonLd } from "@/components/OrgJsonLd";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN, absUrl } from "@/lib/seo";
import { SHOP_BRAND, shopBrand, ensureBrandCapsInText } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const seo = app.theme?.seo;
  const title = shopBrand(seo?.title?.trim() || SHOP_BRAND);
  const description = ensureBrandCapsInText(
    seo?.description?.trim() ||
      `Mua chậu cây & cây cảnh tại ${SHOP_BRAND} — TP.HCM. Xanh mát, dễ chọn, giao nhanh.`
  );
  const favicon = app.theme?.faviconUrl?.trim() || "/brand/logo-icon.png";
  const siteName = shopBrand(app.theme?.siteName?.trim() || title);
  const ogImage = seo?.ogImageUrl?.trim() ? absUrl(seo.ogImageUrl) : undefined;
  const verification = seo?.googleSiteVerification?.trim();

  return {
    metadataBase: new URL(SHOP_ORIGIN),
    title: {
      default: title,
      template: `%s · ${siteName}`,
    },
    description,
    icons: {
      icon: [{ url: favicon, type: "image/png", sizes: "512x512" }],
      apple: [{ url: favicon, type: "image/png" }],
      shortcut: favicon,
    },
    verification: {
      ...(verification ? { google: verification } : {}),
      other: {
        "zalo-platform-site-verification": "NVwcADVw3G4ms8TNplWF2XFmWZN_XbXkDZCt",
      },
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      locale: "vi_VN",
      url: SHOP_ORIGIN,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: siteName }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <ThemeCssServer />
        <OrgJsonLd theme={app.theme} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
