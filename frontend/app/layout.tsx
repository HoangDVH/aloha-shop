import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ThemeCssServer } from "@/components/ThemeCssServer";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const seo = app.theme?.seo;
  const title = seo?.title?.trim() || "ALOHA Thế Giới Chậu Cây";
  const description =
    seo?.description?.trim() ||
    "Mua chậu cây & cây cảnh tại ALOHA Thế Giới Chậu Cây — TP.HCM. Xanh mát, dễ chọn, giao nhanh.";
  const favicon = app.theme?.faviconUrl?.trim() || "/brand/logo-icon.png";
  const siteName = app.theme?.siteName?.trim() || title;

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
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      locale: "vi_VN",
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <ThemeCssServer />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
