"use client";

import { useEffect, useState } from "react";
import { Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRouter } from "@/lib/useShopRouter";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";
import { ShopPageLoader } from "@/components/ShopPageLoader";

export default function CtvPendingPage() {
  const { user, loading, refresh, logout } = useShopAuth();
  const router = useShopRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/dang-nhap?next=${encodeURIComponent(CTV_PENDING_PATH)}`);
      return;
    }
    if (!isCtvPendingBlocked(user)) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <ShopPageLoader fullscreen={false} />;
  }

  if (!isCtvPendingBlocked(user)) {
    return <ShopPageLoader fullscreen={false} />;
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
        <Clock3 size={28} strokeWidth={2.2} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--aloha-ink)]">
        Đang chờ duyệt CTV
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Hồ sơ cộng tác viên của bạn đã gửi thành công. Cửa hàng sẽ duyệt trong thời gian sớm nhất.
        Sau khi duyệt, trang này tự mở cửa hàng — không cần F5.
      </p>

      <div className="mt-6 space-y-2 rounded-2xl bg-[var(--aloha-green-light)]/60 p-4 text-left text-sm ring-1 ring-[#d7e3d2]">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--aloha-green)]" />
          <div>
            <div className="font-semibold text-[var(--aloha-ink)]">{user.fullName || user.email}</div>
            <div className="mt-0.5 text-slate-600">{user.email}</div>
          </div>
        </div>
        <div className="border-t border-[#d7e3d2] pt-2 text-slate-700">
          Mã CTV đăng ký:{" "}
          <strong className="font-mono text-[var(--aloha-green-mid)]">{user.ctvCode || "—"}</strong>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Trạng thái: chờ duyệt
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={checking}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--aloha-green)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--aloha-green-mid)] disabled:opacity-60"
          onClick={async () => {
            setChecking(true);
            try {
              await refresh();
            } finally {
              setChecking(false);
            }
          }}
        >
          <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
          Kiểm tra duyệt
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={async () => {
            await logout();
            router.replace("/dang-nhap");
          }}
        >
          <LogOut size={16} />
          Đăng xuất
        </button>
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Liên hệ cửa hàng ALOHA nếu chờ lâu hơn 1–2 ngày làm việc.
      </p>
    </div>
  );
}
