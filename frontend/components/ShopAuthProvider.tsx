"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useShopLoginMutation,
  useShopLogoutMutation,
  useShopMeQuery,
  useShopRegisterMutation,
  useShopUpdateMeMutation,
} from "@/lib/authQueries";
import type { LoginInput, RegisterInput } from "@/lib/authSchemas";
import type { ShopUser } from "@/lib/auth";
import { useShopLoadingWhile } from "@/lib/useShopLoadingWhile";

export type ShopAuthAction = "login" | "logout" | "register" | null;

type AuthCtx = {
  user: ShopUser | null;
  loading: boolean;
  authBusy: boolean;
  authAction: ShopAuthAction;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (body: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateMe: (body: {
    fullName?: string;
    phone?: string;
    becomeCtv?: boolean;
    ctvCode?: string;
  }) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

/** Một overlay toàn trang cho session boot + đăng nhập/đăng xuất. */
function ShopAuthLoadingSync() {
  const { loading, authBusy } = useShopAuth();
  useShopLoadingWhile(loading || authBusy);
  return null;
}

export function ShopAuthProvider({ children }: { children: ReactNode }) {
  const me = useShopMeQuery();
  const loginMut = useShopLoginMutation();
  const registerMut = useShopRegisterMutation();
  const logoutMut = useShopLogoutMutation();
  const updateMut = useShopUpdateMeMutation();

  const authAction: ShopAuthAction = loginMut.isPending
    ? "login"
    : registerMut.isPending
      ? "register"
      : logoutMut.isPending
        ? "logout"
        : null;
  const authBusy = authAction !== null;

  const value: AuthCtx = {
    user: me.data ?? null,
    loading: me.isLoading && me.data === undefined,
    authBusy,
    authAction,
    refresh: async () => {
      await me.refetch();
    },
    login: async (email, password) => {
      await loginMut.mutateAsync({ email, password });
    },
    register: async (body) => {
      await registerMut.mutateAsync(body);
    },
    logout: async () => {
      await logoutMut.mutateAsync();
    },
    updateMe: async (body) => {
      await updateMut.mutateAsync(body);
    },
  };

  return (
    <Ctx.Provider value={value}>
      <ShopAuthLoadingSync />
      {children}
    </Ctx.Provider>
  );
}

export function useShopAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShopAuth outside ShopAuthProvider");
  return ctx;
}

/** Alias tiện dùng trong form — cùng nguồn React Query. */
export function useShopAuthSession() {
  return useShopAuth();
}

export type { LoginInput, RegisterInput };
