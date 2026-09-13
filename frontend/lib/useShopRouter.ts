"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { notifyShopNavStart } from "@/lib/shopLoading";

/** `router.push/replace` + overlay chuyển trang (chuẩn KiotViet). */
export function useShopRouter() {
  const router = useRouter();

  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        notifyShopNavStart();
        return router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        notifyShopNavStart();
        return router.replace(...args);
      },
    }),
    [router]
  );
}
