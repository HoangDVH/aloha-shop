"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useShopRouter } from "@/lib/useShopRouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  CreditCard,
  Link2,
  LogOut,
  MapPin,
  Receipt,
  User as UserIcon,
} from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { AccountAvatar } from "@/components/AccountAvatar";
import { AddressBookPanel } from "@/components/AddressBookPanel";
import { OrdersPanel } from "@/components/OrdersPanel";
import { useShopUpdateMeMutation } from "@/lib/authQueries";
import { useShopLogoutAction, isShopLoggingOut } from "@/lib/useShopLogoutAction";
import { profileSchema, type ProfileInput } from "@/lib/authSchemas";
import { ShopPageLoader } from "@/components/ShopPageLoader";
import { shopAccountRoleLabel } from "@/lib/accountRoleLabel";

type Tab = "tai-khoan" | "dia-chi" | "don-mua" | "thanh-toan";

function parseTab(raw: string | null): Tab {
  if (
    raw === "dia-chi" ||
    raw === "don-mua" ||
    raw === "thanh-toan" ||
    raw === "tai-khoan"
  ) {
    return raw;
  }
  return "tai-khoan";
}

export default function AccountPage() {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <AccountPageInner />
    </Suspense>
  );
}

function AccountPageInner() {
  const { user, loading } = useShopAuth();
  const { logout, isPending: logoutPending } = useShopLogoutAction();
  const updateMut = useShopUpdateMeMutation();
  const router = useShopRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const datCode = searchParams.get("dat") || "";

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  useEffect(() => {
    // Đăng xuất về "/" — đừng redirect sang /dang-nhap (race + overlay kép)
    if (logoutPending || isShopLoggingOut()) return;
    if (!loading && !user) router.replace("/dang-nhap?next=/tai-khoan");
  }, [user, loading, router, logoutPending]);

  /** Path CTV cũ — chuyển hẳn sang portal */
  useEffect(() => {
    if (searchParams.get("tab") === "hoa-hong") {
      router.replace("/cong-tac-vien");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (searchParams.get("tab") === "hoa-hong") return;
    const t = parseTab(searchParams.get("tab"));
    setTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName || "",
        phone: user.phone || "",
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (logoutPending || isShopLoggingOut()) {
    return null;
  }

  if (loading || !user) {
    return <ShopPageLoader fullscreen={false} />;
  }

  const goTab = (t: Tab) => {
    setTab(t);
    const q = t === "tai-khoan" ? "/tai-khoan" : `/tai-khoan?tab=${t}`;
    router.replace(q);
  };

  const onSave = profileForm.handleSubmit(async (values) => {
    try {
      await updateMut.mutateAsync({
        fullName: values.fullName,
        phone: values.phone || undefined,
      });
      profileForm.clearErrors("root");
      profileForm.setError("root", { type: "success", message: "Đã lưu hồ sơ" });
    } catch (err) {
      profileForm.setError("root", {
        message: err instanceof Error ? err.message : "Lỗi lưu",
      });
    }
  });

  const profileOk = profileForm.formState.errors.root?.type === "success";
  const hasGoogle = user.authProviders.includes("google");
  const roleLabel = shopAccountRoleLabel(user);

  const tabItems: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "tai-khoan", label: "Tài khoản", icon: <UserIcon size={16} /> },
    { id: "dia-chi", label: "Địa chỉ", icon: <MapPin size={16} /> },
    { id: "don-mua", label: "Đơn mua", icon: <Receipt size={16} /> },
    { id: "thanh-toan", label: "Thanh toán", icon: <CreditCard size={16} /> },
  ];

  const navBtn = (id: Tab, label: string, icon: ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => goTab(id)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
        tab === id
          ? "bg-[var(--aloha-green-light)] text-[var(--aloha-green)]"
          : "text-slate-600 hover:bg-[var(--aloha-cream)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 overflow-x-hidden px-4 py-6">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-[var(--aloha-green)]">
          Trang chủ
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-semibold text-[var(--aloha-ink)]">Tài khoản</span>
      </nav>

      {/* Mobile tabs ngang */}
      <div className="sticky top-[var(--shop-chrome-h,7.5rem)] z-30 -mx-4 border-b border-[var(--aloha-line)] bg-[var(--aloha-cream)]/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2">
            {tabItems.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                  tab === t.id
                    ? "bg-[var(--aloha-green)] text-white"
                    : "bg-white text-slate-600 ring-1 ring-[var(--aloha-line)]"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={logoutPending}
            onClick={() => logout()}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-white hover:text-red-600"
            aria-label="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar desktop */}
        <aside className="hidden h-fit space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[var(--aloha-line)] lg:block">
          <div className="flex items-center gap-3 border-b border-[var(--aloha-line)] pb-4">
            <AccountAvatar user={user} size={56}  />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[var(--aloha-ink)]">
                {user.fullName || "Khách ALOHA"}
              </div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
              <div className="mt-1 inline-flex rounded-full bg-[var(--aloha-green-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--aloha-green)]">
                {roleLabel}
              </div>
              {hasGoogle ? (
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32]">
                  <Link2 size={12} />
                  Google đã kết nối
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-0.5">
            {navBtn("tai-khoan", "Tài khoản", <UserIcon size={18} />)}
            {navBtn("dia-chi", "Sổ địa chỉ", <MapPin size={18} />)}
            {navBtn("don-mua", "Đơn mua", <Receipt size={18} />)}
            {navBtn("thanh-toan", "Thanh toán", <CreditCard size={18} />)}
            {user.roles.includes("ctv") && user.ctvStatus === "active" ? (
              <Link
                href="/cong-tac-vien"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-[var(--aloha-cream)]"
              >
                <Link2 size={18} />
                Dashboard CTV
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            disabled={logoutPending}
            onClick={() => logout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-[#fff1f0] hover:text-red-600"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </aside>

        {/* Main */}
        <div className="min-w-0 space-y-4">
          {tab === "tai-khoan" ? (
            <>
              <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)]">
                <AccountAvatar user={user} size={64}  />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-extrabold text-[var(--aloha-ink)]">
                      {user.fullName || "Khách ALOHA"}
                    </h1>
                    {hasGoogle ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[11px] font-bold text-[#2E7D32]">
                        <Check size={12} />
                        Đã xác minh Google
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{user.email}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--aloha-green)]">{roleLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("dia-chi")}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aloha-green)] hover:underline"
                >
                  <MapPin size={16} />
                  Sổ địa chỉ
                </button>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)]">
                <h2 className="text-base font-extrabold text-[var(--aloha-ink)]">Thông tin cá nhân</h2>
                <p className="mt-1 text-sm text-slate-500">Dùng khi đặt hàng và giao nhận.</p>

                <form onSubmit={onSave} className="mt-5 space-y-4" noValidate>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Email
                    </label>
                    <input
                      value={user.email}
                      disabled
                      className="w-full rounded-lg border border-[var(--aloha-line)] bg-[var(--aloha-cream)] px-3 py-2.5 text-sm text-slate-600"
                    />
                    <p className="mt-1 text-xs text-slate-400">Email không thể đổi tại đây.</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Họ và tên
                    </label>
                    <input
                      className="w-full rounded-lg border border-[#D5E3D0] px-3 py-2.5 text-sm outline-none focus:border-[var(--aloha-green)]"
                      {...profileForm.register("fullName")}
                    />
                    {profileForm.formState.errors.fullName ? (
                      <p className="mt-1 text-xs text-red-600">
                        {profileForm.formState.errors.fullName.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Số điện thoại
                    </label>
                    <input
                      placeholder="0901234567"
                      className="w-full rounded-lg border border-[#D5E3D0] px-3 py-2.5 text-sm outline-none focus:border-[var(--aloha-green)]"
                      {...profileForm.register("phone")}
                    />
                  </div>

                  {user.ctvCode ? (
                    <p className="text-sm text-slate-600">
                      Mã CTV: <strong className="text-[var(--aloha-green)]">{user.ctvCode}</strong>
                      {user.ctvStatus ? (
                        <span className="ml-2 text-xs text-slate-500">
                          (
                          {user.ctvStatus === "active"
                            ? "Đã duyệt"
                            : user.ctvStatus === "khoa"
                              ? "Khóa"
                              : "Chờ duyệt"}
                          )
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  {profileForm.formState.errors.root?.message ? (
                    <p className={`text-sm ${profileOk ? "text-[#2E7D32]" : "text-red-600"}`}>
                      {profileForm.formState.errors.root.message}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={updateMut.isPending}
                    className="rounded-lg bg-[var(--aloha-green)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] disabled:opacity-60"
                  >
                    Lưu hồ sơ
                  </button>
                </form>
              </section>

              {!user.roles.includes("ctv") || user.ctvStatus === "tu_choi" ? (
                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)]">
                  <h2 className="text-base font-extrabold text-[var(--aloha-ink)]">
                    {user.ctvStatus === "tu_choi"
                      ? "Nộp lại hồ sơ cộng tác viên"
                      : "Đăng ký làm cộng tác viên"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {user.ctvStatus === "tu_choi" && user.ctvRejectReason
                      ? `Lần trước bị từ chối: ${user.ctvRejectReason}`
                      : "Điền hồ sơ đầy đủ trên trang tuyển CTV — nộp trên đúng tài khoản đang đăng nhập."}
                  </p>
                  <Link
                    href="/tuyen-ctv"
                    className="mt-4 inline-flex rounded-lg bg-[#E65100] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
                  >
                    {user.ctvStatus === "tu_choi" ? "Nộp lại hồ sơ" : "Đăng ký CTV"}
                  </Link>
                </section>
              ) : null}
            </>
          ) : null}

          {tab === "dia-chi" ? <AddressBookPanel /> : null}

          {tab === "don-mua" ? <OrdersPanel highlightCode={datCode || undefined} /> : null}

          {tab === "thanh-toan" ? (
            <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[var(--aloha-line)]">
              <CreditCard className="mx-auto text-[var(--aloha-green)]" size={36} />
              <h2 className="mt-3 text-lg font-extrabold text-[var(--aloha-ink)]">Thanh toán</h2>
              <p className="mt-1 text-sm text-slate-500">
                Chọn COD hoặc chuyển khoản khi xác nhận đơn hàng trên web.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
