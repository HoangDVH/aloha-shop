"use client";

import { advancePriceSession } from "./priceSession";
import { refreshCartPricesFromCatalog } from "./cartPriceRefresh";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchShopMe,
  shopLogin,
  shopLogout,
  shopRegister,
  shopUpdateMe,
  type ShopRole,
  type ShopUser,
} from "@/lib/auth";
import type { LoginInput, ProfileInput, RegisterInput } from "@/lib/authSchemas";

export type CtvApplicationPayload = {
  fullName?: string;
  phone?: string;
  zalo?: string;
  addressText?: string;
  referralChannel?: string;
  channelUrl?: string;
  referralSource?: string;
  hasBusinessExp?: boolean;
  businessExpNote?: string;
  businessExpYears?: number;
};

export type RegisterMutationInput = Omit<RegisterInput, "passwordConfirm"> & CtvApplicationPayload;

export const shopMeQueryKey = ["shop", "auth", "me"] as const;

export function useShopMeQuery() {
  return useQuery({
    queryKey: shopMeQueryKey,
    queryFn: fetchShopMe,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useShopLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => shopLogin(input.email, input.password),
    onSuccess: (data) => {
      qc.setQueryData(shopMeQueryKey, data.user);
      // Xóa cache các query riêng tư của phiên trước tránh rò rỉ dữ liệu
      qc.removeQueries({ queryKey: ["ctv-portal"] });
      qc.removeQueries({ queryKey: ["shop", "orders"] });
      qc.removeQueries({ queryKey: ["shop", "ctv"] });
      qc.removeQueries({ queryKey: ["shop", "si"] });
      qc.removeQueries({ queryKey: ["shop", "cart", "quote"] });
    },
  });
}

export function useShopRegisterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterMutationInput) => {
      const roles: ShopRole[] = [];
      if (input.asCustomer) roles.push("customer");
      if (input.asCtv) roles.push("ctv");
      return shopRegister({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        phone: input.phone || undefined,
        roles,
        ctvCode: input.asCtv ? input.ctvCode : undefined,
        zalo: input.zalo,
        addressText: input.addressText,
        referralChannel: input.referralChannel,
        channelUrl: input.channelUrl,
        referralSource: input.referralSource,
        hasBusinessExp: input.hasBusinessExp,
        businessExpNote: input.businessExpNote,
        businessExpYears: input.businessExpYears,
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(shopMeQueryKey, data.user);
    },
  });
}

export function useShopLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shopLogout(),
    onMutate: () => {
      qc.setQueryData(shopMeQueryKey, null);
      qc.removeQueries({ queryKey: ["ctv-portal"] });
      qc.removeQueries({ queryKey: ["shop", "orders"] });
      qc.removeQueries({ queryKey: ["shop", "ctv"] });
      qc.removeQueries({ queryKey: ["shop", "si"] });
      qc.removeQueries({ queryKey: ["shop", "cart", "quote"] });
    },
    onSettled: () => {
      qc.setQueryData(shopMeQueryKey, null);
      qc.removeQueries({ queryKey: ["ctv-portal"] });
      qc.removeQueries({ queryKey: ["shop", "orders"] });
      qc.removeQueries({ queryKey: ["shop", "ctv"] });
      qc.removeQueries({ queryKey: ["shop", "si"] });
      qc.removeQueries({ queryKey: ["shop", "cart", "quote"] });
      advancePriceSession();
      window.dispatchEvent(new Event("aloha-price-session"));
      void refreshCartPricesFromCatalog().catch(() => {});
    },
  });
}

export function useShopUpdateMeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      fullName?: string;
      phone?: string;
      becomeCtv?: boolean;
      ctvCode?: string;
    } & CtvApplicationPayload) => shopUpdateMe(body),
    onSuccess: (data) => {
      qc.setQueryData(shopMeQueryKey, data.user);
    },
  });
}

export type { ShopUser, ProfileInput };
