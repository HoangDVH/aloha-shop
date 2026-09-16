import type { NextConfig } from "next";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:3001").replace(
  /\/$/,
  ""
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  /**
   * Next 15 mặc định staleTimes.dynamic = 0 → Back/Forward luôn fetch lại RSC
   * (PDP → checkout → Back mất vài giây). Giữ cache client 30s cho trang động.
   */
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  /**
   * URL cũ KiotViet → trang shop mới (301).
   * Bổ sung admin SEO redirects khi backend `/api/shop/redirects` đã deploy.
   */
  async redirects() {
    return [
      {
        source: "/page/ve-chung-toi-14387a",
        destination: "/",
        permanent: true,
      },
      {
        source: "/page/khuyen-mai-1c107c",
        destination: "/",
        permanent: true,
      },
      {
        source: "/branches",
        destination: "/",
        permanent: true,
      },
      {
        source: "/c/cay-phong-thuy-3ac9d3",
        destination: "/danh-muc/cay-phong-thuy",
        permanent: true,
      },
      {
        source: "/c/cay-binh-an-a476a9",
        destination: "/danh-muc/cay-binh-an",
        permanent: true,
      },
      {
        source: "/c/chau-men-hoa-bien-406561",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/brand/logo-icon.png",
      },
      {
        source: "/api/shop/:path*",
        destination: `${API_BASE}/api/shop/:path*`,
      },
      {
        source: "/api/auth/:path*",
        destination: `${API_BASE}/api/auth/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${API_BASE}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
