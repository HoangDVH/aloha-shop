"use client";

import { Fragment, type ReactNode } from "react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { isWholesaleHomeViewer } from "@/lib/homeWholesaleOrder";

export function HomeSectionOrder({ sections }: { sections: { id: string; finished: boolean; node: ReactNode }[] }) {
  const { user } = useShopAuth();
  const ordered = isWholesaleHomeViewer(user)
    ? [...sections.filter(s => !s.finished), ...sections.filter(s => s.finished)]
    : sections;
  return <>{ordered.map(s => <Fragment key={s.id}>{s.node}</Fragment>)}</>;
}
