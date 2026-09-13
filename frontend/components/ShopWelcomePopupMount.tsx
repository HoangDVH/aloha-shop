"use client";

import dynamic from "next/dynamic";

/** Wrapper client — `ssr: false` chỉ được dùng trong Client Component. */
const ShopWelcomePopup = dynamic(
  () => import("@/components/ShopWelcomePopup").then((m) => m.ShopWelcomePopup),
  { ssr: false }
);

export function ShopWelcomePopupMount() {
  return <ShopWelcomePopup />;
}
