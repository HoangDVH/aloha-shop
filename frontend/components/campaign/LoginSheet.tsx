"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useShopLoginMutation } from "@/lib/authQueries";
import { googleStartUrl } from "@/lib/auth";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Bảng đăng nhập ngay trên trang (không rời trang đang xem). Đăng nhập xong gọi `onDone`;
 * việc khách định làm (lưu mã…) đã được ghi trước bằng `setPendingIntent` nên cả luồng Google cũng tiếp tục được.
 */
export function LoginSheet({
  open,
  onClose,
  onDone,
  title,
}: {
  open: boolean;
  /** Khách đóng bảng mà không đăng nhập. */
  onClose: () => void;
  onDone: () => void;
  title?: string;
}) {
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const loginMut = useShopLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginMut.mutateAsync({ email: email.trim(), password });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi đăng nhập");
    }
  };

  const next = encodeURIComponent(currentPath());
  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center bg-black/55 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X size={18} aria-hidden />
        </button>
        <h2 id={titleId} className="pr-10 text-lg font-extrabold text-slate-900">
          {title || "Đăng nhập để lưu mã"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Đăng nhập xong mã sẽ tự lưu vào ví của bạn.</p>
        <div className="mt-4">
          <GoogleAuthButton href={googleStartUrl(currentPath())} label="Đăng nhập với Google" />
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            className="auth-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mật khẩu"
            aria-label="Mật khẩu"
            className="auth-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
          <button type="submit" disabled={loginMut.isPending || !email || !password} className="auth-submit">
            Đăng nhập
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Chưa có tài khoản?{" "}
          <Link href={`/dang-ky?next=${next}`} className="font-bold text-[var(--aloha-green)]">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  );
}
