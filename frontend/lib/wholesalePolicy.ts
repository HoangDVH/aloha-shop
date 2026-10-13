"use client";
import { useQuery } from "@tanstack/react-query";
import { siRequest } from "./siQueries";
export type WholesalePolicy = { hcmFirstMinimum: number; tinhMinimum: number; finishedQuantity: number;
  cheapPotQuantity: number; cheapPotPrice: number; rawQuantity: number; version: string };
export const defaultWholesalePolicy: WholesalePolicy = { hcmFirstMinimum: 2000000, tinhMinimum: 2000000,
  finishedQuantity: 5, cheapPotQuantity: 5, cheapPotPrice: 15000, rawQuantity: 10, version: "2026-10-13.1" };
export function useWholesalePolicy() {
  return useQuery({ queryKey: ["shop", "wholesale-policy"], queryFn: () => siRequest<WholesalePolicy>("/api/shop/wholesale-policy"), refetchInterval: 15000 });
}
