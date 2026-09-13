import type { NextConfig } from "next";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:3000").replace(
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
  async rewrites() {
    return [
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
