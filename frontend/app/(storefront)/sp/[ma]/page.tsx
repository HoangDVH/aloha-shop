import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatVnd } from "@/lib/api";
import { getProductByMa } from "@/lib/shopProductServer";
import { ShareRedirect } from "@/components/ShareRedirect";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import { SHOP_ORIGIN, absUrl, plainText } from "@/lib/seo";

export const revalidate = 30;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { ma: maRaw } = await params;
  const ma = decodeURIComponent(maRaw || "").trim();
  const sp = searchParams ? await searchParams : {};
  const ctvRaw = Array.isArray(sp.ctv) ? sp.ctv[0] : sp.ctv;
  const ctv = String(ctvRaw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);

  const pageUrl = ctv
    ? `${SHOP_ORIGIN}/sp/${encodeURIComponent(ma)}?ctv=${encodeURIComponent(ctv)}`
    : `${SHOP_ORIGIN}/sp/${encodeURIComponent(ma)}`;

  try {
    const { item } = await getProductByMa(ma);
    if (!item) return { title: "Sản phẩm" };

    const price = formatVnd(item.gia);
    const stock =
      item.ton > 0
        ? `Còn khoảng ${item.ton} ${item.dvt || ""}`.trim()
        : "Đặt trước — giao khi có hàng";
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
      // Canonical = link ngắn /sp/... — nếu trỏ về /c/... Messenger hay lấy bản preview xám đã cache.
      alternates: { canonical: pageUrl.split("?")[0] },
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
            secureUrl: image,
            type: "image/jpeg",
            width: 1200,
            height: 630,
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
        "og:image:type": "image/jpeg",
      },
    };
  } catch {
    return { title: "Sản phẩm" };
  }
}

export default async function ShareProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ma: maRaw } = await params;
  const ma = decodeURIComponent(maRaw || "").trim();
  const sp = searchParams ? await searchParams : {};
  const ctvRaw = Array.isArray(sp.ctv) ? sp.ctv[0] : sp.ctv;
  const ctv = String(ctvRaw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);

  let item: Awaited<ReturnType<typeof getProductByMa>>["item"] | null = null;
  try {
    item = (await getProductByMa(ma)).item;
  } catch {
    item = null;
  }
  if (!item) notFound();

  const dest = ctv
    ? `${item.path}?ctv=${encodeURIComponent(ctv)}`
    : item.path;

  const canonicalPath = item.path || `/sp/${encodeURIComponent(ma)}`;
  const jsonLdUrl = `${SHOP_ORIGIN}${canonicalPath}`;

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <ProductJsonLd product={item} pageUrl={jsonLdUrl} />
      <p className="text-sm text-slate-500">Đang mở sản phẩm…</p>
      <p className="mt-2 text-lg font-bold text-[#222]">{item.ten}</p>
      <ShareRedirect href={dest} />
      <a href={dest} className="mt-6 inline-block text-sm font-semibold text-[#2E7D32] underline">
        Bấm vào đây nếu không tự chuyển
      </a>
    </main>
  );
}
