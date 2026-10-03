"use client";

import type { ReactNode } from "react";
import { useVoucherClaims } from "@/lib/campaign/useVoucherClaims";
import { LoginSheet } from "@/components/campaign/LoginSheet";
import type { EvaluatedCandidateUI } from "./PromotionModal";

/**
 * Nút "Lưu" trên vé chưa đủ điều kiện vì chưa lưu vào ví. Lưu xong gọi `onClaimed` để
 * trang tính lại ưu đãi (vé chuyển sang nhóm dùng được).
 */
export function useCandidateClaim(onClaimed: () => void) {
  const claims = useVoucherClaims({ onClaimed });

  const ineligibleAction = (cand: EvaluatedCandidateUI): ReactNode => {
    if (!cand.needsClaim) {
      return (
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
          Chưa đủ điều kiện
        </span>
      );
    }
    const busy = claims.pendingId === cand.promotionId;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => claims.claim(cand.promotionId)}
        className="min-h-[34px] rounded-full bg-[#165A36] px-3.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60 shadow-2xs transition-all active:scale-95"
      >
        {busy ? "Đang lưu…" : "Lưu & Dùng"}
      </button>
    );
  };

  const loginSheet = <LoginSheet open={claims.loginOpen} onClose={claims.cancelLogin} onDone={claims.loginDone} />;
  return { ineligibleAction, loginSheet, claim: claims.claim };
}
