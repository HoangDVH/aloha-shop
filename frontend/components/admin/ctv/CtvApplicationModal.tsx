"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCtvUiStore } from "./ctvUiStore";
import {
  useApproveCtvMutation,
  useRejectCtvMutation,
  useShopAccountQuery,
} from "./ctvQueries";
import { maskPhone } from "./shared/format";
import { CTV_REFERRAL_CHANNELS } from "@/lib/ctvRecruitSchema";

function channelLabel(code: string | null | undefined) {
  const c = CTV_REFERRAL_CHANNELS.find((x) => x.value === code);
  return c?.label || code || "—";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

type Props = {
  onDone?: () => void;
};

export function CtvApplicationModal({ onDone }: Props) {
  const reviewAccountId = useCtvUiStore((s) => s.reviewAccountId);
  const setReviewAccountId = useCtvUiStore((s) => s.setReviewAccountId);
  const { data, isLoading, error, refetch } = useShopAccountQuery(reviewAccountId);
  const approveMut = useApproveCtvMutation();
  const rejectMut = useRejectCtvMutation();
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  const open = Boolean(reviewAccountId);
  const user = data?.user;
  const busy = approveMut.isPending || rejectMut.isPending;

  useEffect(() => {
    if (!open) {
      setRejectMode(false);
      setReason("");
      setLocalError("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setReviewAccountId(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, setReviewAccountId]);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    setReviewAccountId(null);
  };

  const row = (label: string, value: ReactNode) => (
    <div className="min-w-0">
      <div className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="mt-0.5 break-words text-sm text-slate-800">{value || "—"}</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ctv-app-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0b141a]/55 backdrop-blur-[2px]"
        aria-label="Đóng"
        onClick={close}
      />
      <div className="relative z-[1] flex max-h-[min(92svh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
            {(user?.fullName || user?.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="ctv-app-modal-title"
              className="truncate text-base font-bold text-slate-900"
            >
              {user?.fullName || "Hồ sơ CTV"}
            </h2>
            <span className="mt-0.5 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">
              Chờ duyệt
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Đang tải hồ sơ…</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              {error instanceof Error ? error.message : "Không tải được hồ sơ"}
            </p>
          ) : user ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {row("Họ tên", user.fullName)}
              {row("SĐT", maskPhone(user.phone))}
              {row("Email", user.email)}
              {row("Zalo", user.zalo)}
              {row("Địa chỉ", user.addressText)}
              {row("Kênh bán", channelLabel(user.referralChannel))}
              {row(
                "Link kênh",
                user.channelUrl ? (
                  <a
                    href={user.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium text-emerald-700 hover:underline"
                  >
                    {user.channelUrl}
                  </a>
                ) : (
                  "—"
                )
              )}
              {row("Nguồn biết Aloha", user.referralSource)}
              {row(
                "Kinh nghiệm KD",
                user.hasBusinessExp === true
                  ? "Có rồi"
                  : user.hasBusinessExp === false
                    ? "Chưa có"
                    : "—"
              )}
              {user.hasBusinessExp
                ? row("Ngành / mô tả", user.businessExpNote)
                : null}
              {user.hasBusinessExp
                ? row(
                    "Số năm",
                    user.businessExpYears != null ? String(user.businessExpYears) : "—"
                  )
                : null}
              {row("Ngày gửi", fmtDate(user.createdAt))}
              {row("Mã CTV", user.ctvCode ? <span className="font-mono">{user.ctvCode}</span> : "—")}
            </div>
          ) : null}

          {rejectMode ? (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-slate-600" htmlFor="reject-reason">
                Lý do từ chối
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do gửi cho CTV…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          ) : null}

          {localError ? (
            <p className="mt-3 text-sm font-medium text-red-600">{localError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          {!rejectMode ? (
            <>
              <button
                type="button"
                disabled={busy || !user || user.ctvStatus !== "cho_duyet"}
                onClick={async () => {
                  if (!user) return;
                  setLocalError("");
                  try {
                    await approveMut.mutateAsync(user.id);
                    setReviewAccountId(null);
                    onDone?.();
                  } catch (e) {
                    setLocalError(e instanceof Error ? e.message : "Không duyệt được");
                    void refetch();
                  }
                }}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approveMut.isPending ? "Đang duyệt…" : "Duyệt CTV"}
              </button>
              <button
                type="button"
                disabled={busy || !user || user.ctvStatus !== "cho_duyet"}
                onClick={() => setRejectMode(true)}
                className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Từ chối
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRejectMode(false);
                  setReason("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim() || !user}
                onClick={async () => {
                  if (!user) return;
                  setLocalError("");
                  try {
                    await rejectMut.mutateAsync({ id: user.id, reason: reason.trim() });
                    setReviewAccountId(null);
                    onDone?.();
                  } catch (e) {
                    setLocalError(e instanceof Error ? e.message : "Không từ chối được");
                    void refetch();
                  }
                }}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {rejectMut.isPending ? "Đang gửi…" : "Xác nhận từ chối"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
