import type { MetadataRoute } from "next";
import { SHOP_ORIGIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/gio-hang",
          "/xac-nhan-don-hang",
          "/tai-khoan",
          "/don-hang",
          "/dang-nhap",
          "/dang-ky",
          "/cho-duyet-ctv",
          "/admin",
          "/api/",
        ],
      },
    ],
    sitemap: `${SHOP_ORIGIN}/sitemap.xml`,
    host: SHOP_ORIGIN,
  };
}
