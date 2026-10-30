import type { Metadata } from "next";
import { PlantDoctorPage } from "@/components/plantDoctor/PlantDoctorPage";
import { SHOP_BRAND, shopBrand } from "@/lib/brand";
import { fetchAppearance, fallbackAppearance } from "@/lib/appearance";
import { SHOP_ORIGIN, absUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const app = await fetchAppearance().catch(() => fallbackAppearance());
  const site = shopBrand(app.theme?.siteName) || SHOP_BRAND;
  const title = "Bác sĩ cây cảnh AI - Chẩn đoán bệnh cây qua ảnh";
  const description = `Chụp ảnh cây bị bệnh để Bác sĩ AI của ${site} nhận diện loài cây, phát hiện bệnh lý và hướng dẫn phác đồ cấp cứu 4 bước chuẩn chuyên gia trong 3 giây. Miễn phí 100%.`;
  const canonical = `${SHOP_ORIGIN}/bac-si-cay`;
  const ogImage = absUrl("/brand/logo-aloha.png");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      siteName: site,
      title: `${title} · ${site}`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `Bác sĩ cây cảnh AI - ${site}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${site}`,
      description,
      images: [ogImage],
    },
  };
}

export default function BacSiCayPage() {
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Bác sĩ cây cảnh Aloha AI",
    url: `${SHOP_ORIGIN}/bac-si-cay`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "VND",
    },
    description:
      "Công cụ trí tuệ nhân tạo (AI) nhận diện loài cây và chẩn đoán bệnh lý cây cảnh thông minh qua ảnh chụp, đưa ra phác đồ cấp cứu 4 bước chuẩn chuyên gia.",
    provider: {
      "@type": "Organization",
      name: "ALOHA THẾ GIỚI CHẬU CÂY",
      url: SHOP_ORIGIN,
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Bác sĩ cây cảnh AI Aloha có mất phí không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Hoàn toàn miễn phí 100%. Bạn có thể chụp ảnh hoặc tải ảnh cây lên bất cứ lúc nào để nhận diện loài cây và phác đồ điều trị trong 3 giây.",
        },
      },
      {
        "@type": "Question",
        name: "Bác sĩ cây cảnh AI có thể nhận diện được những bệnh gì?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Bác sĩ AI nhận diện chính xác các bệnh lý phổ biến như úng rễ, thối thân, cháy nắng sốc nhiệt, rệp sáp, bọ trĩ, nấm đốm lá, thiếu sáng, thiếu nước và phân biệt hiện tượng vàng lá sinh lý tự nhiên.",
        },
      },
      {
        "@type": "Question",
        name: "Cây bị úng thối rễ có nên thay chậu to hơn không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tuyệt đối không! Chậu to giữ nhiều đất và nước sẽ khiến rễ thối nhanh hơn. Cần ngưng tưới, xăm lỗ đất thoát khí bằng đũa, cắt rễ thối và trồng vào chậu vừa khít rễ.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PlantDoctorPage />
    </>
  );
}
