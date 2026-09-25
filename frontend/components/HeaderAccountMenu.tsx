"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  LogOut,
  MapPin,
  Receipt,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopLogoutAction } from "@/lib/useShopLogoutAction";
import { useShopLoginHref } from "@/lib/useShopLoginHref";
import { AccountAvatar } from "@/components/AccountAvatar";
import { shopAccountRoleLabel } from "@/lib/accountRoleLabel";

export function HeaderAccountMenu() {
  const { user, loading } = useShopAuth();
  const { logout, isPending: logoutPending } = useShopLogoutAction();
  const loginHref = useShopLoginHref();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (loading) {
    return (
      <span
        className="hidden h-9 w-24 sm:inline-block"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href={loginHref}
        className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-[var(--aloha-green-dark)] hover:bg-[var(--aloha-green-light)] sm:inline-flex"
      >
        <UserIcon size={22} strokeWidth={1.75} aria-hidden />
        <span className="text-sm font-semibold">Tài khoản</span>
      </Link>
    );
  }

  const shortName =
    user.fullName.trim().split(/\s+/).slice(-2).join(" ") || user.email.split("@")[0];
  const roleLabel = shopAccountRoleLabel(user);
  const isCtv = user.roles.includes("ctv") && user.ctvStatus === "active";

  const itemClass =
    "flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--aloha-green-light)] hover:text-[var(--aloha-green)]";

  return (
    <div className="relative hidden sm:block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md px-1.5 py-1 text-[var(--aloha-green-dark)] hover:bg-[var(--aloha-green-light)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Tài khoản ${shortName}`}
      >
        <AccountAvatar user={user} size={28} />
        <span className="min-w-0 truncate text-sm font-semibold">{shortName}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`shrink-0 opacity-70 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[280px] overflow-hidden rounded-xl border border-[var(--aloha-line)] bg-white shadow-xl"
        >
          <div className="bg-[var(--aloha-green)] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <AccountAvatar user={user} size={48} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {user.fullName || "Khách ALOHA"}
                </div>
                <div className="truncate text-xs text-white/80">{user.email}</div>
                <div className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide">
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>
          <div className="py-1.5">
            <Link
              href="/tai-khoan"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <UserIcon size={18} className="text-[var(--aloha-green)]" />
              Tài khoản
            </Link>
            <Link
              href="/tai-khoan?tab=dia-chi"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <MapPin size={18} className="text-[var(--aloha-green)]" />
              Sổ địa chỉ
            </Link>
            <Link
              href="/tai-khoan?tab=don-mua"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Receipt size={18} className="text-[var(--aloha-green)]" />
              Đơn mua
            </Link>
            <Link
              href="/tai-khoan?tab=thanh-toan"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <CreditCard size={18} className="text-[var(--aloha-green)]" />
              Thanh toán
            </Link>
            {isCtv ? (
              <Link
                href="/cong-tac-vien"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Wallet size={18} className="text-[var(--aloha-green)]" />
                Dashboard CTV
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              disabled={logoutPending}
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-[#fff1f0] hover:text-red-600"
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
