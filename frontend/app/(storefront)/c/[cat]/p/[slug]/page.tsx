import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatVnd } from "@/lib/api";
import { getProductByPath } from "@/lib/shopProductServer";
import { ProductDetailView } from "@/components/ProductDetailView";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import {
  RelatedProductsSection,
  RelatedProductsSkeleton,
} from "@/components/RelatedProductsSection";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN, absUrl, plainText } from "@/lib/seo";
import { resolveProductSeo } from "@/lib/seoTemplates";
import { buildBreadcrumbJsonLd } from "@/lib/seoSchema";

export const revalidate = 30;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ cat: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { cat, slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const ctvRaw = Array.isArray(sp.ctv) ? sp.ctv[0] : sp.ctv;
  const ctv = String(ctvRaw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);

  const path = `/c/${cat}/p/${slug}`;
  const pageUrl = ctv
    ? `${SHOP_ORIGIN}${path}?ctv=${encodeURIComponent(ctv)}`
    : `${SHOP_ORIGIN}${path}`;

  try {
    const [{ item }, app] = await Promise.all([
      getProductByPath(path),
      fetchAppearance().catch(() => fallbackAppearance()),
    ]);
    if (!item) return { title: "Sản phẩm" };

    const price = formatVnd(item.gia);
    const stock =
      item.ton > 0
        ? `Còn khoảng ${item.ton} ${item.dvt || ""}`.trim()
        : "Đặt trước — giao khi có hàng";
    const descPlain = plainText(item.description || "");
    const fallbackDescription =
      descPlain.slice(0, 140) ||
      `${item.ten} — Giá ${price}. ${stock}. Mua tại ALOHA Thế Giới Chậu Cây.`;
    const siteName = app.theme?.siteName?.trim() || "ALOHA Thế Giới Chậu Cây";
    const seo = app.theme?.seo;

    const resolved = resolveProductSeo({
      overrideTitle: item.seoTitle,
      overrideDescription: item.seoDescription,
      titleTemplate: seo?.productTitleTemplate,
      descriptionTemplate: seo?.productDescriptionTemplate,
      vars: {
        ten: item.ten,
        gia: price,
        ma: item.ma,
        danhMuc: item.categoryName || item.nhom || "",
        tenCuaHang: siteName,
      },
      fallbackTitle: `${item.ten} | ${price}`,
      fallbackDescription,
    });

    const image =
      absUrl(item.anh || item.images?.[0] || "") ||
      absUrl("/brand/logo-aloha.png");

    return {
      title: resolved.title,
      description: resolved.description,
      alternates: { canonical: `${SHOP_ORIGIN}${path}` },
      openGraph: {
        type: "website",
        siteName,
        locale: "vi_VN",
        url: pageUrl.split("?")[0],
        title: resolved.title,
        description: resolved.description,
        images: [{ url: image, width: 800, height: 800, alt: item.ten }],
      },
      twitter: {
        card: "summary_large_image",
        title: resolved.title,
        description: resolved.description,
        images: [image],
      },
      other: {
        "product:price:amount": String(Math.round(Number(item.gia) || 0)),
        "product:price:currency": "VND",
        "og:price:amount": String(Math.round(Number(item.gia) || 0)),
        "og:price:currency": "VND",
      },
    };
  } catch {
    return { title: "Sản phẩm" };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ cat: string; slug: string }>;
}) {
  const { cat, slug } = await params;
  const path = `/c/${cat}/p/${slug}`;
  let item: Awaited<ReturnType<typeof getProductByPath>>["item"] | null = null;
  let app = fallbackAppearance();
  try {
    const [prod, appearance] = await Promise.all([
      getProductByPath(path),
      fetchAppearance().catch(() => fallbackAppearance()),
    ]);
    item = prod.item;
    app = appearance;
  } catch {
    item = null;
  }
  if (!item) notFound();

  const pageUrl = `${SHOP_ORIGIN}${item.path || path}`;
  const showProductJsonLd = app.theme?.seo?.enableProductJsonLd !== false;
  const crumbs = [
    { name: "Trang chủ", path: "/" },
    {
      name: item.categoryName || item.nhom || "Sản phẩm",
      path: item.categorySlug ? `/danh-muc/${item.categorySlug}` : "/tim",
    },
    { name: item.ten, path: item.path || path },
  ];

  return (
    <>
      {showProductJsonLd ? <ProductJsonLd product={item} pageUrl={pageUrl} /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(crumbs)),
        }}
      />
      <ProductDetailView product={item} />
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProductsSection nhom={item.nhom || ""} ma={item.ma} />
      </Suspense>
    </>
  );
}
