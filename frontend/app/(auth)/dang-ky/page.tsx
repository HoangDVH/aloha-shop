"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useShopRouter } from "@/lib/useShopRouter";
import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRegisterMutation } from "@/lib/authQueries";
import { googleStartUrl, safeAuthNext } from "@/lib/auth";
import { registerSchema, type RegisterInput } from "@/lib/authSchemas";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { PasswordField } from "@/components/PasswordField";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";

function RegisterForm() {
  const { user, loading } = useShopAuth();
  const registerMut = useShopRegisterMutation();
  const router = useShopRouter();
  const sp = useSearchParams();
  const next = safeAuthNext(sp.get("next"), "/");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      asCustomer: true,
      asCtv: false,
      ctvCode: "",
    },
  });

  const asCtv = watch("asCtv");
  const asCustomer = watch("asCustomer");
  const asCtvField = register("asCtv");
  const asCustomerField = register("asCustomer");

  useEffect(() => {
    if (loading || !user) return;
    if (isCtvPendingBlocked(user)) {
      router.replace(CTV_PENDING_PATH);
      return;
    }
    router.replace(next.startsWith("/") ? next : "/");
  }, [loading, user, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await registerMut.mutateAsync({
        ...values,
        ctvCode: values.ctvCode ? values.ctvCode.toUpperCase() : values.ctvCode,
      });
      if (isCtvPendingBlocked(data.user)) {
        router.replace(CTV_PENDING_PATH);
      } else {
        router.replace(next.startsWith("/") ? next : "/");
      }
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Lỗi đăng ký",
      });
    }
  });

  return (
    <div>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--aloha-ink)]">Đăng ký</h1>
        <p className="mt-1.5 text-sm text-slate-500">Tạo tài khoản khách hoặc cộng tác viên</p>
      </div>

      <div className="mt-7 space-y-3">
        <GoogleAuthButton href={googleStartUrl(next)} label="Đăng ký với Google" />
        <div className="flex items-center gap-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
          <div className="h-px flex-1 bg-[#ebe6dc]" />
          hoặc email
          <div className="h-px flex-1 bg-[#ebe6dc]" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3.5" noValidate>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="reg-name">
            Họ và tên
          </label>
          <input id="reg-name" placeholder="Nguyễn Văn A" className="auth-field" {...register("fullName")} />
          {errors.fullName ? (
            <p className="mt-1.5 text-xs font-medium text-red-600">{errors.fullName.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            className="auth-field"
            {...register("email")}
          />
          {errors.email ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="reg-phone">
            Số điện thoại <span className="font-normal text-slate-400">(tuỳ chọn)</span>
          </label>
          <input id="reg-phone" placeholder="09xx xxx xxx" className="auth-field" {...register("phone")} />
        </div>
        <PasswordField
          id="reg-password"
          label="Mật khẩu"
          autoComplete="new-password"
          placeholder="Ít nhất 6 ký tự"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="space-y-2.5 rounded-2xl bg-[var(--aloha-green-light)]/70 p-3.5 ring-1 ring-[#d7e3d2]">
          <p className="text-xs font-bold tracking-wide text-[var(--aloha-green-mid)] uppercase">
            Loại tài khoản
          </p>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--aloha-ink)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#b7c9b4] text-[var(--aloha-green)] focus:ring-[var(--aloha-green)]"
              {...asCustomerField}
              onChange={(e) => {
                asCustomerField.onChange(e);
                if (!e.target.checked && !watch("asCtv")) {
                  setValue("asCtv", true);
                }
              }}
            />
            Khách mua hàng
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--aloha-ink)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#b7c9b4] text-[var(--aloha-green)] focus:ring-[var(--aloha-green)]"
              {...asCtvField}
              onChange={(e) => {
                asCtvField.onChange(e);
                // Đăng ký CTV thuần → vào trang chờ duyệt (bỏ tick khách)
                if (e.target.checked) setValue("asCustomer", false);
              }}
            />
            Cộng tác viên (CTV)
          </label>
          {errors.asCustomer ? (
            <p className="text-xs font-medium text-red-600">{errors.asCustomer.message}</p>
          ) : null}
          {asCtv ? (
            <div className="pt-1">
              <input
                placeholder="Mã CTV (vd: ALOHA01) — để trống sẽ tự tạo"
                className="auth-field uppercase"
                {...register("ctvCode", {
                  setValueAs: (v) => String(v || "").toUpperCase(),
                })}
              />
              {errors.ctvCode ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.ctvCode.message}</p>
              ) : null}
              <p className="mt-1.5 text-xs text-slate-500">
                {asCtv && !asCustomer
                  ? "Chỉ đăng ký CTV: sau khi gửi sẽ vào trang chờ duyệt, cửa hàng duyệt xong mới vào shop."
                  : "Mã CTV chờ cửa hàng duyệt trước khi tính hoa hồng."}
              </p>
            </div>
          ) : null}
        </div>

        {errors.root?.message ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {errors.root.message}
          </p>
        ) : null}
        <button type="submit" disabled={registerMut.isPending} className="auth-submit">
          Tạo tài khoản
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Đã có tài khoản?{" "}
        <Link
          href={`/dang-nhap?next=${encodeURIComponent(next)}`}
          className="font-bold text-[var(--aloha-green)] hover:text-[var(--aloha-green-mid)]"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <RegisterForm />
    </Suspense>
  );
}
