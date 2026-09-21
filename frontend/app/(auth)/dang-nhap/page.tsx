"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useShopRouter } from "@/lib/useShopRouter";
import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopLoginMutation } from "@/lib/authQueries";
import { googleStartUrl, safeAuthNext } from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/authSchemas";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { PasswordField } from "@/components/PasswordField";
import { resolvePostLoginPath } from "@/lib/ctvGate";

function LoginForm() {
  const { user, loading } = useShopAuth();
  const loginMut = useShopLoginMutation();
  const router = useShopRouter();
  const sp = useSearchParams();
  const next = safeAuthNext(sp.get("next"), "/");
  const errQ = sp.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (loading || !user) return;
    router.replace(resolvePostLoginPath(user, next));
  }, [loading, user, next, router]);

  useEffect(() => {
    if (errQ === "locked") {
      setError("root", { message: "Tài khoản đã bị khóa" });
    } else if (errQ) {
      setError("root", { message: "Đăng nhập Google thất bại. Thử lại hoặc dùng email." });
    }
  }, [errQ, setError]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await loginMut.mutateAsync(values);
      router.replace(resolvePostLoginPath(data.user, next));
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Lỗi đăng nhập",
      });
    }
  });

  return (
    <div>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--aloha-ink)]">Đăng nhập</h1>
        <p className="mt-1.5 text-sm text-slate-500">Chào mừng trở lại cửa hàng ALOHA</p>
      </div>

      <div className="mt-7 space-y-3">
        <GoogleAuthButton href={googleStartUrl(next)} label="Đăng nhập với Google" />
        <div className="flex items-center gap-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
          <div className="h-px flex-1 bg-[#ebe6dc]" />
          hoặc email
          <div className="h-px flex-1 bg-[#ebe6dc]" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3.5" noValidate>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            className="auth-field"
            {...register("email")}
          />
          {errors.email ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p> : null}
        </div>
        <PasswordField
          id="login-password"
          label="Mật khẩu"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />
        {errors.root?.message ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {errors.root.message}
          </p>
        ) : null}
        <button type="submit" disabled={loginMut.isPending} className="auth-submit">
          Đăng nhập
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Chưa có tài khoản?{" "}
        <Link
          href={`/dang-ky?next=${encodeURIComponent(next)}`}
          className="font-bold text-[var(--aloha-green)] hover:text-[var(--aloha-green-mid)]"
        >
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <LoginForm />
    </Suspense>
  );
}
