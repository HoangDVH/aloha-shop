"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { getPixelIds, DEFAULT_PIXEL_ID } from "@/lib/analytics/facebookPixel";

function PixelRouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstLoadRef = useRef(true);

  useEffect(() => {
    // Không ghi nhận lượt xem trên các trang quản trị nội bộ
    if (pathname?.startsWith("/admin") || pathname?.startsWith("/cong-tac-vien")) {
      return;
    }
    // Lượt xem trang ban đầu đã được script base tự động bắn
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams]);

  return null;
}

export function FacebookPixel() {
  const pixelIds = getPixelIds();
  const primaryPixelId = pixelIds[0] || DEFAULT_PIXEL_ID;

  if (!primaryPixelId) return null;

  return (
    <>
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            ${pixelIds.map((id) => `fbq('init', '${id}');`).join("\n")}
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(primaryPixelId)}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      <Suspense fallback={null}>
        <PixelRouteChangeTracker />
      </Suspense>
    </>
  );
}
