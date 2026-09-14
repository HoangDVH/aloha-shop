"use client";

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

export const shopMeQueryKey = ["shop", "auth", "me"] as const;

export function useShopMeQuery() {
  return useQuery({
    queryKey: shopMeQueryKey,
    queryFn: fetchShopMe,
    staleTime: 60_000,
    retry: false,
  });
}

export function useShopLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => shopLogin(input.email, input.password),
    onSuccess: (data) => {
      qc.setQueryData(shopMeQueryKey, data.user);
    },
  });
}

export function useShopRegisterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => {
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
      // Xóa session trên UI ngay — không chờ API / không clear toàn bộ cache
      // (qc.clear() khiến /me + trang chủ refetch → overlay vài giây).
      qc.setQueryData(shopMeQueryKey, null);
    },
    onSettled: () => {
      qc.setQueryData(shopMeQueryKey, null);
      // Chỉ bỏ query gắn tài khoản, giữ catalog/cache trang chủ
      qc.removeQueries({ queryKey: ["shop", "orders"] });
      qc.removeQueries({ queryKey: ["shop", "ctv"] });
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
    }) => shopUpdateMe(body),
    onSuccess: (data) => {
      qc.setQueryData(shopMeQueryKey, data.user);
    },
  });
}

export type { ShopUser, ProfileInput };
