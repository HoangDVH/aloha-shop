"use client";
import type { ShopOrder } from "@/lib/orders";
import { OrderOverview } from "./OrderOverview";
import type { heroFor } from "./orderHero";

export function OrderSuccessView({
  order,
  hero,
  isPaid,
  addressLine,
  payLabel,
  itemCount,
  justConfirmed,
  reload,
}: {
  order: ShopOrder;
  hero: ReturnType<typeof heroFor>;
  isPaid: boolean;
  addressLine: string;
  payLabel: string;
  itemCount: number;
  justConfirmed: boolean;
  reload: (silent?: boolean) => Promise<void>;
}) {
  return <OrderOverview order={order} hero={hero} addressLine={addressLine} payLabel={payLabel} />;
}
