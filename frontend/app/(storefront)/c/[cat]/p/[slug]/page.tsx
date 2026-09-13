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
import { SHOP_ORIGIN, absUrl, plainText } from "@/lib/seo";

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
    const { item } = await getProductByPath(path);
    if (!item) return { title: "Sản phẩm" };

    const price = formatVnd(item.gia);
    const stock =
      item.ton > 0 ? `Còn khoảng ${item.ton} ${item.dvt || ""}`.trim() : "Hết hàng";
    const descPlain = plainText(item.description || "");
    const description =
      descPlain.slice(0, 140) ||
      `${item.ten} — Giá ${price}. ${stock}. Mua tại ALOHA Thế Giới Chậu Cây.`;

    const image =
      absUrl(item.anh || item.images?.[0] || "") ||
      absUrl("/brand/logo-aloha.png");

    const title = `${item.ten} | ${price}`;

    return {
      title: item.ten,
      description,
      alternates: { canonical: `${SHOP_ORIGIN}${path}` },
      openGraph: {
        type: "website",
        siteName: "ALOHA Thế Giới Chậu Cây",
        locale: "vi_VN",
        url: pageUrl,
        title,
        description,
        images: [
          {
            url: image,
            width: 800,
            height: 800,
            alt: item.ten,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
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
  try {
    const res = await getProductByPath(path);
    item = res.item;
  } catch {
    item = null;
  }
  if (!item) notFound();

  const pageUrl = `${SHOP_ORIGIN}${item.path || path}`;

  return (
    <>
      <ProductJsonLd product={item} pageUrl={pageUrl} />
      <ProductDetailView product={item} />
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProductsSection nhom={item.nhom || ""} ma={item.ma} />
      </Suspense>
    </>
  );
}
