"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydratedQuery } from "@/lib/useHydratedQuery";
import { adminFetch, adminKeys, AdminApiError, refreshAdminSession } from "@/components/admin/api/adminFetch";
import type { AdminUser, StaffLoginInput } from "@/components/admin/auth/schemas";

type MeRes = { user: AdminUser };

export function useAdminSession(opts?: { requireManager?: boolean }) {
  const requireManager = opts?.requireManager !== false;
  const pathname = usePathname() || "";
  const router = useRouter();
  const qc = useQueryClient();
  const isLoginPage = pathname.startsWith("/admin/dang-nhap");

  const me = useHydratedQuery(useQuery({
    queryKey: adminKeys.me,
    queryFn: () => adminFetch<MeRes>("/api/auth/me"),
    retry: (failureCount, error) => {
      // Nếu là 401/403 (sau khi silent refresh đã thử và thất bại) thì dừng ngay
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 60_000,
    enabled: pathname.startsWith("/admin"),
  }));

  const user = me.data?.user ?? null;
  const isManager = user?.role === "manager" || user?.username === "aloha" || user?.username === "admin";

  // Proactive silent refresh mỗi 25 phút giúp access token (60p) luôn mới, admin không bao giờ bị gián đoạn
  useEffect(() => {
    if (!pathname.startsWith("/admin") || isLoginPage || !user) return;
    const INTERVAL_MS = 25 * 60 * 1000;
    const timer = setInterval(() => {
      refreshAdminSession().catch(() => {});
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pathname, isLoginPage, user]);

  useEffect(() => {
    if (!pathname.startsWith("/admin") || isLoginPage) return;
    if (me.isLoading) return;
    if (me.isError || !user) {
      router.replace(`/admin/dang-nhap?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (requireManager && !isManager) {
      router.replace("/admin/dang-nhap?error=forbidden");
    }
  }, [pathname, isLoginPage, me.isLoading, me.isError, user, isManager, requireManager, router]);

  const login = useMutation({
    mutationFn: (body: StaffLoginInput) =>
      adminFetch<MeRes>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(adminKeys.me, data);
    },
  });

  const logout = useMutation({
    mutationFn: () =>
      adminFetch("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null),
    onMutate: () => {
      qc.removeQueries({ queryKey: ["admin"] });
    },
    onSettled: () => {
      qc.removeQueries({ queryKey: ["admin"] });
      router.replace("/admin/dang-nhap");
    },
  });

  return {
    user,
    isManager,
    loading: me.isLoading,
    error: me.error,
    login,
    logout,
    refresh: () => me.refetch(),
    isUnauthorized:
      me.error instanceof AdminApiError && (me.error.status === 401 || me.error.status === 403),
  };
}
