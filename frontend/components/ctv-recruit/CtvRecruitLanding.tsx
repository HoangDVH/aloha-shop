"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgePercent,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Gift,
  Headphones,
  Link2,
  Package,
  Percent,
  Share2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRegisterMutation, useShopUpdateMeMutation } from "@/lib/authQueries";
import { useShopRouter } from "@/lib/useShopRouter";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";
import { SHOP_BRAND } from "@/lib/brand";
import { shopLoginHref } from "@/lib/auth";
import {
  CTV_REFERRAL_CHANNELS,
  CTV_REFERRAL_SOURCES,
  ctvRecruitGuestSchema,
  ctvRecruitLoggedInSchema,
  toCtvApplicationPayload,
  type CtvRecruitGuestInput,
  type CtvRecruitLoggedInInput,
} from "@/lib/ctvRecruitSchema";
import { PasswordField } from "@/components/PasswordField";
import { CtvTermsAccept, CtvTermsBody } from "@/components/ctv-recruit/CtvTermsAccept";

type CtvFormValues = CtvRecruitGuestInput | CtvRecruitLoggedInInput;

const QUICK_BENEFITS = [
  { icon: Percent, title: "Hoa hồng đến 15%" },
  { icon: Boxes, title: "4.000+ sản phẩm" },
  { icon: Sparkles, title: "Công cụ bán sẵn" },
  { icon: Wallet, title: "Thanh toán nhanh" },
];

const WHY_CARDS = [
  {
    icon: BadgePercent,
    title: "Hoa hồng hấp dẫn",
    desc: "Mức hoa hồng cạnh tranh theo từng sản phẩm, càng bán nhiều càng nhận nhiều.",
  },
  {
    icon: Package,
    title: "Sản phẩm chất lượng",
    desc: "Kho chậu & cây chọn lọc, hình ảnh thật — dễ chia sẻ, dễ chốt đơn.",
  },
  {
    icon: Share2,
    title: "Hỗ trợ toàn diện",
    desc: "Có link giới thiệu, ảnh mẫu, nội dung bán hàng sẵn để đăng ngay.",
  },
  {
    icon: Headphones,
    title: "Đội ngũ hỗ trợ",
    desc: "Tư vấn Zalo / hotline khi cần — không để bạn bán một mình.",
  },
  {
    icon: Sprout,
    title: "Phát triển lâu dài",
    desc: "Xây dựng thu nhập thụ động từ đam mê cây xanh cùng Aloha.",
  },
];

const STEPS = [
  {
    n: 1,
    icon: Users,
    title: "Đăng ký tài khoản",
    desc: "Bấm Đăng ký ngay — điền form và chờ Aloha duyệt CTV.",
  },
  {
    n: 2,
    icon: Link2,
    title: "Nhận link & sản phẩm",
    desc: "Vào cổng CTV lấy link, ảnh và mã giới thiệu.",
  },
  {
    n: 3,
    icon: Gift,
    title: "Chia sẻ & kiếm hoa hồng",
    desc: "Đăng bán trên mạng xã hội — nhận hoa hồng khi đơn thành công.",
  },
];

function CtvRecruitForm({ onClose }: { onClose?: () => void }) {
  const { user, loading } = useShopAuth();
  const registerMut = useShopRegisterMutation();
  const updateMut = useShopUpdateMeMutation();
  const router = useShopRouter();
  const [done, setDone] = useState(false);
  const loggedIn = Boolean(user);
  const rejected = Boolean(
    user?.roles.includes("ctv") && user.ctvStatus === "tu_choi"
  );
  const locked =
    Boolean(user && (user.active === false || user.ctvStatus === "khoa"));

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
      referralChannel: (user?.referralChannel as CtvRecruitGuestInput["referralChannel"]) || undefined,
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

  useEffect(() => {
    if (loading || !user) return;
    if (isCtvPendingBlocked(user) || user.ctvStatus === "cho_duyet") {
      router.replace(CTV_PENDING_PATH);
      return;
    }
    if (user.roles.includes("ctv") && user.ctvStatus === "active") {
      router.replace("/cong-tac-vien");
    }
  }, [loading, user, router]);

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
      } else if (dataUser.roles.includes("ctv") && dataUser.ctvStatus === "active") {
        router.replace("/cong-tac-vien");
      } else {
        router.replace(CTV_PENDING_PATH);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không gửi được. Thử lại sau.";
      setError("root", { message: msg });
    }
  });

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-lg ring-1 ring-[var(--aloha-line)] sm:p-8">
        <CheckCircle2 className="mx-auto text-[var(--aloha-green)]" size={40} strokeWidth={1.75} />
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
      <div className="relative rounded-2xl bg-white p-6 shadow-lg ring-1 ring-[var(--aloha-line)] sm:p-8">
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

  const fieldErr = (name: keyof CtvFormValues) => {
    const e = errors[name as keyof typeof errors];
    return e && "message" in e ? String(e.message) : null;
  };

  return (
    <div
      id="ctv-dang-ky"
      className="relative rounded-2xl bg-white p-5 shadow-[0_18px_48px_-20px_rgba(27,94,32,0.35)] ring-1 ring-[var(--aloha-line)] sm:p-7"
    >
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

      <form onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
        <fieldset className="space-y-3.5">
          <legend className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Liên hệ
          </legend>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-name">
              Họ và tên
            </label>
            <input id="ctv-name" placeholder="Nguyễn Văn A" className="auth-field" {...register("fullName")} />
            {fieldErr("fullName") ? (
              <p className="mt-1 text-xs font-medium text-red-600">{fieldErr("fullName")}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-phone">
              Số điện thoại
            </label>
            <input
              id="ctv-phone"
              inputMode="tel"
              placeholder="09xx xxx xxx"
              className="auth-field"
              {...register("phone")}
            />
            {fieldErr("phone") ? (
              <p className="mt-1 text-xs font-medium text-red-600">{fieldErr("phone")}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-zalo">
              Zalo
            </label>
            <input
              id="ctv-zalo"
              placeholder="SĐT Zalo hoặc https://zalo.me/..."
              className="auth-field"
              {...register("zalo")}
            />
            {fieldErr("zalo") ? (
              <p className="mt-1 text-xs font-medium text-red-600">{fieldErr("zalo")}</p>
            ) : null}
          </div>
          {!loggedIn ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-email">
                  Email
                </label>
                <input
                  id="ctv-email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@email.com"
                  className="auth-field"
                  {...register("email" as keyof CtvFormValues)}
                />
                {fieldErr("email" as keyof CtvFormValues) ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErr("email" as keyof CtvFormValues)}
                  </p>
                ) : null}
              </div>
              <PasswordField
                id="ctv-pass"
                label="Mật khẩu"
                autoComplete="new-password"
                placeholder="Ít nhất 8 ký tự"
                error={fieldErr("password" as keyof CtvFormValues) || undefined}
                {...register("password" as keyof CtvFormValues)}
              />
              <PasswordField
                id="ctv-pass2"
                label="Xác nhận mật khẩu"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                error={fieldErr("passwordConfirm" as keyof CtvFormValues) || undefined}
                {...register("passwordConfirm" as keyof CtvFormValues)}
              />
            </>
          ) : (
            <p className="rounded-xl bg-[var(--aloha-green-light)]/70 px-3 py-2 text-xs text-[var(--aloha-muted)]">
              Đang nộp trên tài khoản <strong>{user?.email}</strong> — không cần nhập lại email /
              mật khẩu.
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-addr">
              Địa chỉ
            </label>
            <input
              id="ctv-addr"
              placeholder="Số nhà, đường, phường, tỉnh/thành"
              className="auth-field"
              {...register("addressText")}
            />
            {fieldErr("addressText") ? (
              <p className="mt-1 text-xs font-medium text-red-600">{fieldErr("addressText")}</p>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Kinh nghiệm kinh doanh
          </legend>
          <Controller
            name="hasBusinessExp"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "chua_co" as const, label: "Chưa có" },
                    { v: "co_roi" as const, label: "Có rồi" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => field.onChange(opt.v)}
                    className={`rounded-xl px-3 py-3 text-sm font-bold ring-1 transition ${
                      field.value === opt.v
                        ? "bg-[var(--aloha-green-light)] text-[var(--aloha-green-dark)] ring-[var(--aloha-green)]"
                        : "bg-white text-slate-600 ring-[var(--aloha-line)] hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />
          {fieldErr("hasBusinessExp") ? (
            <p className="text-xs font-medium text-red-600">{fieldErr("hasBusinessExp")}</p>
          ) : null}
          {hasExp === "co_roi" ? (
            <div className="space-y-3 rounded-xl bg-[#FDF6E3]/70 p-3 ring-1 ring-[var(--aloha-border-brown)]/40">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                  htmlFor="ctv-exp-note"
                >
                  Bạn đang / đã kinh doanh gì?
                </label>
                <input
                  id="ctv-exp-note"
                  placeholder="VD: bán cây cảnh trên Facebook"
                  className="auth-field"
                  {...register("businessExpNote")}
                />
                {fieldErr("businessExpNote") ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErr("businessExpNote")}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                  htmlFor="ctv-exp-years"
                >
                  Số năm kinh nghiệm
                </label>
                <input
                  id="ctv-exp-years"
                  type="number"
                  min={1}
                  max={50}
                  inputMode="numeric"
                  placeholder="1–50"
                  className="auth-field"
                  {...register("businessExpYears")}
                />
                {fieldErr("businessExpYears") ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErr("businessExpYears")}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  Kênh bán
                </p>
                <label
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                  htmlFor="ctv-channel"
                >
                  Bạn bán chủ yếu trên kênh nào?
                </label>
                <select id="ctv-channel" className="auth-field" {...register("referralChannel")}>
                  <option value="">— Chọn kênh —</option>
                  {CTV_REFERRAL_CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {fieldErr("referralChannel") ? (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErr("referralChannel")}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                  htmlFor="ctv-url"
                >
                  Link kênh / trang bán
                </label>
                <input
                  id="ctv-url"
                  placeholder="https://..."
                  className="auth-field"
                  {...register("channelUrl")}
                />
                {fieldErr("channelUrl") ? (
                  <p className="mt-1 text-xs font-medium text-red-600">{fieldErr("channelUrl")}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-3.5">
          <legend className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            Bạn biết đến Aloha
          </legend>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-source">
              Bạn biết đến Aloha qua đâu?{" "}
              <span className="font-normal text-slate-400">(tuỳ chọn)</span>
            </label>
            <select id="ctv-source" className="auth-field" {...register("referralSource")}>
              <option value="">— Chọn nguồn —</option>
              {CTV_REFERRAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <CtvTermsAccept
          agreed={agreeTerms === true}
          error={fieldErr("agreeTerms") || undefined}
          onAgreed={() => {
            setValue("agreeTerms", true, { shouldValidate: true, shouldDirty: true });
            clearErrors("agreeTerms");
          }}
        />

        {errors.root?.message ? (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            <p>{errors.root.message}</p>
            {/đã được đăng ký|Email đã/i.test(errors.root.message) && !loggedIn ? (
              <p className="mt-1 text-xs font-normal">
                <Link href={shopLoginHref("/tuyen-ctv")} className="font-bold underline">
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
          <ShieldCheck size={14} className="text-[var(--aloha-green)]" aria-hidden />
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

/** Landing tuyển CTV — UI theo mock + đăng ký CTV thật. */
export function CtvRecruitLanding() {
  const { user } = useShopAuth();
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFormOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [formOpen]);

  const openForm = () => setFormOpen(true);
  const closeForm = () => setFormOpen(false);

  return (
    <div className="bg-[#FAF9F6] text-[#202622]">
      {/* Hero — 2 cột kiểu landing Affiliate sàn TMĐT */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-[#FAF9F6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-tr.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-4 top-0 z-0 h-28 w-28 opacity-[0.12] sm:h-44 sm:w-44"
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold tracking-wide text-[#202622] uppercase">
              <Sprout size={14} aria-hidden />
              Cộng tác viên Aloha
            </p>
            <h1 className="mt-4 text-[1.85rem] font-extrabold leading-[1.2] tracking-tight text-[#202622] sm:text-[2.35rem]">
              Chia sẻ cây xanh — <span className="text-[var(--aloha-green-dark)]">nhận hoa hồng</span>
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-slate-600 sm:text-base">
              Đăng ký miễn phí, lấy link bán, nhận hoa hồng đến 15% mỗi đơn thành công.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openForm}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--aloha-green-dark)] px-6 text-[15px] font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--aloha-green-dark)]"
              >
                Đăng ký ngay
                <ChevronRight size={18} aria-hidden />
              </button>
              <a
                href="https://zalo.me/0794901233"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 text-[15px] font-bold text-[#202622] transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-500"
              >
                Liên hệ tư vấn
              </a>
            </div>
          </div>

          {/* Điểm nổi bật — chỉ tiêu đề ngắn */}
          <ul className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-200/70 pt-5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6">
            {QUICK_BENEFITS.map(({ icon: Icon, title }) => (
              <li
                key={title}
                className="inline-flex items-center gap-2 text-[13px] font-medium text-stone-600 sm:text-sm"
              >
                <Icon
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 text-[#526759]"
                  aria-hidden
                />
                {title}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Form đăng ký — chỉ hiện khi bấm Đăng ký ngay */}
      {formOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ctv-dang-ky"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#0b141a]/55 backdrop-blur-[2px]"
            aria-label="Đóng"
            onClick={closeForm}
          />
          <div className="relative z-[1] max-h-[min(92svh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <CtvRecruitForm
              key={user?.id || "guest"}
              onClose={closeForm}
            />
          </div>
        </div>
      ) : null}

      {/* Vì sao */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-extrabold text-[#202622] sm:text-[1.75rem]">
            Vì sao nên trở thành CTV Aloha?
          </h2>
          <p className="max-w-md text-sm text-[var(--aloha-muted)]">
            Lợi ích rõ ràng — phù hợp người mới bắt đầu bán online.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WHY_CARDS.map(({ icon: Icon, title, desc }) => (
            <article
              key={title}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)] transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-[#526759]">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-3 text-[15px] font-extrabold text-[var(--aloha-ink)]">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--aloha-muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Quy trình */}
      <section className="border-y border-[var(--aloha-line)] bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-[#202622] sm:text-[1.75rem]">
            <Sprout size={22} className="text-[#526759]" aria-hidden />
            Quy trình tham gia đơn giản
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative flex flex-col items-center text-center md:px-4">
                {i < STEPS.length - 1 ? (
                  <span
                    className="pointer-events-none absolute top-7 left-[58%] hidden h-0.5 w-[84%] bg-stone-200 md:block"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-lg font-bold text-[#202622] ring-1 ring-stone-200">
                  {step.n}
                </span>
                <span className="mt-3 text-[#526759]">
                  <step.icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-2 text-base font-extrabold text-[var(--aloha-ink)]">{step.title}</h3>
                <p className="mt-1.5 max-w-[16rem] text-sm text-[var(--aloha-muted)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Điều khoản CTV */}
      <section
        id="dieu-khoan-ctv"
        className="scroll-mt-24 border-t border-[var(--aloha-line)] bg-white py-10 sm:py-12"
      >
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-xl font-extrabold text-[#202622] sm:text-2xl">
            Điều khoản cộng tác viên
          </h2>
          <div className="mt-4">
            <CtvTermsBody />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-stone-200 bg-[#F3F2EE] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-6 sm:grid-cols-3">
            {[
              { icon: Package, title: "Sản phẩm chất lượng", desc: "Cây & chậu chọn lọc" },
              { icon: ShieldCheck, title: "Đóng gói cẩn thận", desc: "Giao hàng toàn quốc" },
              { icon: Headphones, title: "Hỗ trợ 24/7", desc: "Zalo / hotline sẵn sàng" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#526759] ring-1 ring-stone-200">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-bold text-[var(--aloha-ink)]">{title}</div>
                  <p className="text-xs text-[var(--aloha-muted)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="max-w-sm text-lg font-extrabold leading-snug text-[#202622] sm:text-xl lg:text-right">
            Cùng Aloha lan tỏa màu xanh
          </p>
        </div>
      </section>
    </div>
  );
}
