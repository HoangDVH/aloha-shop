"use client";

import { useEffect, useState } from "react";
import { Clock3, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRouter } from "@/lib/useShopRouter";
import { useShopLogoutAction, isShopLoggingOut } from "@/lib/useShopLogoutAction";
import {
  CTV_DASHBOARD_PATH,
  CTV_PENDING_PATH,
  isActiveCtv,
  isCtvPendingBlocked,
} from "@/lib/ctvGate";
import { ShopPageLoader } from "@/components/ShopPageLoader";

export default function CtvPendingPage() {
  const { user, loading, refresh } = useShopAuth();
  const router = useShopRouter();
  const { logout, isPending: logoutPending } = useShopLogoutAction();
  const [checking, setChecking] = useState(false);

  // Sau khi admin duyệt → nhảy thẳng dashboard CTV
  useEffect(() => {
    if (loading) return;
    if (logoutPending || isShopLoggingOut()) return;
    if (!user) {
      router.replace(`/dang-nhap?next=${encodeURIComponent(CTV_PENDING_PATH)}`);
      return;
    }
    if (user.ctvStatus === "tu_choi") return;
    if (isActiveCtv(user)) {
      router.replace(CTV_DASHBOARD_PATH);
      return;
    }
    if (!isCtvPendingBlocked(user)) {
      router.replace("/");
    }
  }, [loading, user, router, logoutPending]);

  // Poll trạng thái duyệt — không cần F5
  useEffect(() => {
    if (loading || !user) return;
    if (logoutPending || isShopLoggingOut()) return;
    if (user.ctvStatus !== "cho_duyet") return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled || isShopLoggingOut()) return;
      try {
        await refresh();
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loading, user?.id, user?.ctvStatus, refresh, logoutPending]);

  if (logoutPending || isShopLoggingOut()) {
    return null;
  }

  if (loading || !user) {
    return <ShopPageLoader fullscreen={false} />;
  }

  const rejected = user.ctvStatus === "tu_choi";
  if (!rejected && (isActiveCtv(user) || !isCtvPendingBlocked(user))) {
    return <ShopPageLoader fullscreen={false} />;
  }

  return (
    <div className="text-center">
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${
          rejected
            ? "bg-rose-50 text-rose-700 ring-rose-100"
            : "bg-amber-50 text-amber-700 ring-amber-100"
        }`}
      >
        <Clock3 size={28} strokeWidth={2.2} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--aloha-ink)]">
        {rejected ? "Hồ sơ CTV bị từ chối" : "Đang chờ duyệt CTV"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {rejected
          ? "Bạn có thể sửa hồ sơ và nộp lại trên trang tuyển CTV."
          : "Hồ sơ cộng tác viên của bạn đã gửi thành công. Cửa hàng sẽ duyệt trong thời gian sớm nhất. Sau khi duyệt, trang này tự chuyển sang bảng điều khiển CTV — không cần F5."}
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
        {rejected ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
            {user.ctvRejectReason
              ? `Lý do: ${user.ctvRejectReason}`
              : "Hồ sơ chưa được duyệt."}
            <div className="mt-2">
              <a href="/tuyen-ctv" className="font-bold text-[var(--aloha-green)] hover:underline">
                Nộp lại hồ sơ
              </a>
            </div>
          </div>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Trạng thái: chờ duyệt · tự kiểm tra mỗi 5 giây
          </div>
        )}
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
          onClick={() => logout()}
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
