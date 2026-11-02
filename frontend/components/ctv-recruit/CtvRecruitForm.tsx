"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import {
  useShopRegisterMutation,
  useShopUpdateMeMutation,
} from "@/lib/authQueries";
import { useShopRouter } from "@/lib/useShopRouter";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";
import { shopLoginHref } from "@/lib/auth";
import {
  ctvRecruitGuestSchema,
  ctvRecruitLoggedInSchema,
  toCtvApplicationPayload,
  type CtvRecruitGuestInput,
} from "@/lib/ctvRecruitSchema";
import { CtvTermsAccept } from "@/components/ctv-recruit/CtvTermsAccept";
import { CtvFormFields } from "./CtvFormFields";
import type { CtvFormValues } from "./recruitData";

export function CtvRecruitForm({ onClose }: { onClose?: () => void }) {
  const { user, loading } = useShopAuth();
  const registerMut = useShopRegisterMutation();
  const updateMut = useShopUpdateMeMutation();
  const router = useShopRouter();
  const [done, setDone] = useState(false);
  const loggedIn = Boolean(user);
  const isCtvActive = Boolean(
    user && user.roles.includes("ctv") && user.ctvStatus === "active",
  );
  const isCtvPending = Boolean(
    user && (user.ctvStatus === "cho_duyet" || isCtvPendingBlocked(user)),
  );
  const rejected = Boolean(
    user?.roles.includes("ctv") && user.ctvStatus === "tu_choi",
  );
  const locked = Boolean(
    user && (user.active === false || user.ctvStatus === "khoa"),
  );

  const schema = loggedIn ? ctvRecruitLoggedInSchema : ctvRecruitGuestSchema;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    clearErrors,
    formState: { errors, isValid },
    setError,
  } = useForm<CtvFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      zalo: user?.zalo || "",
      addressText: user?.addressText || "",
      referralChannel:
        (user?.referralChannel as CtvRecruitGuestInput["referralChannel"]) ||
        undefined,
      channelUrl: user?.channelUrl || "",
      referralSource: user?.referralSource || "",
      hasBusinessExp: user?.hasBusinessExp
        ? "co_roi"
        : user?.hasBusinessExp === false
          ? "chua_co"
          : undefined,
      businessExpNote: user?.businessExpNote || "",
      businessExpYears:
        user?.businessExpYears != null ? String(user.businessExpYears) : "",
      agreeTerms: false,
      ...(loggedIn
        ? {}
        : {
            email: "",
            password: "",
            passwordConfirm: "",
          }),
    },
  });

  const hasExp = watch("hasBusinessExp");
  const agreeTerms = watch("agreeTerms");
  const pending = registerMut.isPending || updateMut.isPending;
  const canSubmit = isValid && agreeTerms === true && !pending && !locked;

  // Không tự động redirect khi vào trang để CTV có thể xem landing page / chính sách

  const onSubmit = handleSubmit(async (values) => {
    try {
      const app = toCtvApplicationPayload(values);
      if (values.referralSource) {
        try {
          sessionStorage.setItem("aloha:ctv-source", values.referralSource);
        } catch {
          /* ignore */
        }
      }

      let dataUser;
      if (loggedIn && user) {
        const data = await updateMut.mutateAsync({
          becomeCtv: true,
          ...app,
        });
        dataUser = data.user;
      } else {
        const guest = values as CtvRecruitGuestInput;
        const data = await registerMut.mutateAsync({
          email: guest.email,
          password: guest.password,
          asCustomer: false,
          asCtv: true,
          ctvCode: "",
          ...app,
        });
        dataUser = data.user;
      }

      setDone(true);
      onClose?.();
      if (isCtvPendingBlocked(dataUser) || dataUser.ctvStatus === "cho_duyet") {
        router.replace(CTV_PENDING_PATH);
      } else if (
        dataUser.roles.includes("ctv") &&
        dataUser.ctvStatus === "active"
      ) {
        router.replace("/cong-tac-vien");
      } else {
        router.replace(CTV_PENDING_PATH);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không gửi được. Thử lại sau.";
      setError("root", { message: msg });
    }
  });

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-6 sm:p-8 text-center shadow-sm border border-stone-200/90">
        <CheckCircle2
          className="mx-auto text-[var(--aloha-green)]"
          size={40}
          strokeWidth={1.75}
        />
        <h3 className="mt-3 text-lg font-extrabold text-[var(--aloha-green-dark)]">
          Đã gửi đăng ký CTV
        </h3>
        <p className="mt-2 text-sm text-[var(--aloha-muted)]">
          Aloha đang duyệt hồ sơ — bạn sẽ vào trang chờ duyệt ngay.
        </p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="relative rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-stone-200/90">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        ) : null}
        <h3 className="pr-10 text-lg font-extrabold text-[var(--aloha-green-dark)]">
          Tài khoản đang bị khóa
        </h3>
        <p className="mt-2 text-sm text-[var(--aloha-muted)]">
          Liên hệ Aloha để được hỗ trợ trước khi nộp hồ sơ CTV.
        </p>
      </div>
    );
  }

  if (isCtvActive) {
    return (
      <div className="rounded-3xl bg-white p-6 sm:p-8 text-center shadow-sm border border-stone-200/90">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
          <CheckCircle2 size={36} strokeWidth={2} />
        </div>
        <h3 className="text-xl font-extrabold text-[var(--aloha-green-dark)] sm:text-2xl">
          Bạn đã là Cộng tác viên chính thức của Aloha
        </h3>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-stone-600">
          Tài khoản của bạn đã được kích hoạt quyền CTV. Bạn có thể truy cập Bảng điều khiển để lấy link chia sẻ sản phẩm, theo dõi đơn hàng và hoa hồng.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/cong-tac-vien"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[var(--aloha-green-dark)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green)] active:scale-98"
          >
            Vào Bảng điều khiển CTV
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  }

  if (isCtvPending) {
    return (
      <div className="rounded-3xl bg-white p-6 sm:p-8 text-center shadow-sm border border-stone-200/90">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldCheck size={36} strokeWidth={2} />
        </div>
        <h3 className="text-xl font-extrabold text-[#0f3822] sm:text-2xl">
          Hồ sơ CTV của bạn đang chờ duyệt
        </h3>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-stone-600">
          Aloha đã tiếp nhận hồ sơ đăng ký của bạn. Ban quản trị sẽ đối chiếu thông tin và kích hoạt tài khoản trong thời gian sớm nhất.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={CTV_PENDING_PATH}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[var(--aloha-green-dark)] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green)] active:scale-98"
          >
            Xem trạng thái hồ sơ
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  }

  const fieldErr = (name: keyof CtvFormValues) => {
    const e = errors[name as keyof typeof errors];
    return e && "message" in e ? String(e.message) : null;
  };

  return (
    <div
      id="ctv-dang-ky"
      className="relative rounded-3xl bg-white p-5 sm:p-8 shadow-sm border border-stone-200/90"
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          aria-label="Đóng"
        >
          <X size={18} />
        </button>
      ) : null}
      <h3 className="pr-10 text-lg font-extrabold text-[var(--aloha-green-dark)] sm:text-xl">
        {rejected ? "Nộp lại hồ sơ CTV" : "Đăng ký trở thành CTV Aloha"}
      </h3>
      <p className="mt-1 text-sm text-[var(--aloha-muted)]">
        Điền đủ thông tin — nút gửi chỉ bật khi hồ sơ hợp lệ.
      </p>

      {rejected && user?.ctvRejectReason ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
          Lần trước bị từ chối: <strong>{user.ctvRejectReason}</strong>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="mt-5 space-y-5"
        noValidate
      >
        <CtvFormFields
          register={register}
          control={control}
          hasExp={hasExp}
          loggedIn={loggedIn}
          userEmail={user?.email}
          fieldErr={fieldErr}
        />

        <CtvTermsAccept
          agreed={agreeTerms === true}
          error={fieldErr("agreeTerms") || undefined}
          onAgreed={() => {
            setValue("agreeTerms", true, {
              shouldValidate: true,
              shouldDirty: true,
            });
            clearErrors("agreeTerms");
          }}
        />

        {errors.root?.message ? (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            <p>{errors.root.message}</p>
            {/đã được đăng ký|Email đã/i.test(errors.root.message) &&
            !loggedIn ? (
              <p className="mt-1 text-xs font-normal">
                <Link
                  href={shopLoginHref("/tuyen-ctv")}
                  className="font-bold underline"
                >
                  Đăng nhập
                </Link>{" "}
                rồi nộp hồ sơ trên đúng tài khoản đó.
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--aloha-green-dark)] text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang gửi…" : rejected ? "Nộp lại hồ sơ" : "Gửi đăng ký"}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[var(--aloha-muted)]">
          <ShieldCheck
            size={14}
            className="text-[var(--aloha-green)]"
            aria-hidden
          />
          Thông tin của bạn được bảo mật tuyệt đối
        </p>

        {!loggedIn ? (
          <p className="text-center text-xs text-[var(--aloha-muted)]">
            Đã có tài khoản?{" "}
            <Link
              href={shopLoginHref("/tuyen-ctv")}
              className="font-bold text-[var(--aloha-green)] hover:underline"
            >
              Đăng nhập
            </Link>
          </p>
        ) : null}
      </form>
    </div>
  );
}
