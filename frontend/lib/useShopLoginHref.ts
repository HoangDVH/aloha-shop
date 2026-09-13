"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { shopLoginHref } from "@/lib/auth";

/** Href đăng nhập → sau login quay lại đúng URL hiện tại. */
export function useShopLoginHref() {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const qs = sp.toString();
  const next = `${pathname}${qs ? `?${qs}` : ""}`;
  return shopLoginHref(next);
}
