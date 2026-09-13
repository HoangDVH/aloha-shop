"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { staffLoginSchema, type StaffLoginInput } from "@/components/admin/auth/schemas";
import { useAdminSession } from "@/components/admin/auth/useAdminSession";
import { AdminApiError } from "@/components/admin/api/adminFetch";
import { PasswordField } from "@/components/PasswordField";

export function AdminLoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const forbidden = sp.get("error") === "forbidden";
  const { login } = useAdminSession({ requireManager: false });

  const form = useForm<StaffLoginInput>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await login.mutateAsync(values);
      const u = res.user;
      const ok =
        u.role === "manager" || u.username === "aloha" || u.username === "admin";
      if (!ok) {
        form.setError("root", { message: "Chỉ tài khoản Quản lý mới vào được Admin Shop." });
        return;
      }
      router.replace(next.startsWith("/admin") ? next : "/admin");
    } catch (e) {
      const msg =
        e instanceof AdminApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Đăng nhập thất bại";
      form.setError("root", { message: msg });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold text-slate-600"
          htmlFor="admin-login-username"
        >
          Tên đăng nhập
        </label>
        <input
          id="admin-login-username"
          className="auth-field"
          autoComplete="username"
          placeholder="username"
          {...form.register("username")}
        />
        {form.formState.errors.username ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">
            {form.formState.errors.username.message}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="admin-login-password"
        label="Mật khẩu"
        autoComplete="current-password"
        placeholder="••••••••"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />

      {forbidden ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
          Tài khoản không có quyền Quản lý.
        </p>
      ) : null}
      {form.formState.errors.root ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <button type="submit" disabled={login.isPending} className="auth-submit inline-flex items-center justify-center gap-2">
        {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Đăng nhập Admin
      </button>
    </form>
  );
}
