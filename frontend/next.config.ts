import type { NextConfig } from "next";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:3001").replace(
  /\/$/,
  ""
);
/** Webhook KV vào domain công khai → backend cùng máy; không dùng API_BASE vì có thể là chính domain này (lặp vô hạn). */
const API_INTERNAL = (process.env.SHOP_API_INTERNAL || "http://127.0.0.1:3001").replace(/\/$/, "");

const nextConfig: NextConfig = {
  /** Chỉ `next dev --turbopack` (local); build production dùng webpack nên bỏ qua. */
  ...(process.env.TURBOPACK ? { turbopack: { root: process.cwd() } } : {}),
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
    /** Rewrite /api/shop → backend mặc định cắt sau 30s; Bác sĩ cây có thể chạy tới ~55s khi đổi model dự phòng. */
    proxyTimeout: 70_000,
  },
  /**
   * URL cũ KiotViet → trang shop mới (301).
   * Pattern slug-hash hàng loạt (+ alias) xử lý trong middleware.
   */
  async redirects() {
    return [
      {
        source: "/page/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/branches",
        destination: "/",
        permanent: true,
      },
      {
        source: "/products/:path*",
        destination: "/tim",
        permanent: true,
      },
      {
        source: "/blogs",
        destination: "/bai-viet",
        permanent: true,
      },
      {
        source: "/blogs/:path*",
        destination: "/bai-viet",
        permanent: true,
      },
      {
        source: "/branch-deactivate",
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
      {
        source: "/api/kv-webhook/:path*",
        destination: `${API_INTERNAL}/api/kv-webhook/:path*`,
      },
    ];
  },
};

export default nextConfig;
