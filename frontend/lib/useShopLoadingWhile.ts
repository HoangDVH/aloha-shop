"use client";

import { useEffect } from "react";
import { startShopLoading, stopShopLoading } from "@/lib/shopLoading";

/** Bật overlay logo toàn trang trong lúc `active` — thay chữ «Đang tải». */
export function useShopLoadingWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    startShopLoading();
    return () => stopShopLoading();
  }, [active]);
}
