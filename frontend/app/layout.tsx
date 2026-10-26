import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ClientErrorMonitor } from "@/components/ClientErrorMonitor";
import { ThemeCssServer } from "@/components/ThemeCssServer";
import { OrgJsonLd } from "@/components/OrgJsonLd";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN, absUrl } from "@/lib/seo";
import { SHOP_BRAND, shopBrand, ensureBrandCapsInText } from "@/lib/brand";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

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
    manifest: "/manifest.json",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,600&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://pub-47761e6b4231489580175c7b8a2d0490.r2.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pub-47761e6b4231489580175c7b8a2d0490.r2.dev" />
      </head>
      <body className="min-h-screen antialiased">
        <ClientErrorMonitor />
        <ThemeCssServer />
        <OrgJsonLd theme={app.theme} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
