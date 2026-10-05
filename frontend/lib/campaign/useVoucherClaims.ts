"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useToast } from "@/components/Toast";
import { CURRENT_CAMPAIGN_KEY } from "./campaignQueries";
import { setPendingIntent, takePendingIntent } from "./walletApi";
import { WALLET_KEY, useClaimAll, useClaimVoucher, useWallet } from "./walletQueries";

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Lưu mã / thu thập tất cả, gồm luồng khách chưa đăng nhập: ghi ý định → mở bảng đăng nhập →
 * đăng nhập xong tự làm tiếp (một lần, dù nhiều kho voucher cùng mở).
 */
export function useVoucherClaims(opts: { onClaimed?: () => void } = {}) {
  const onClaimedRef = useRef(opts.onClaimed);
  onClaimedRef.current = opts.onClaimed;
  const { user } = useShopAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const wallet = useWallet(Boolean(user));
  const claimOne = useClaimVoucher();
  const claimAll = useClaimAll();
  const [loginOpen, setLoginOpen] = useState(false);
  const [claimedVoucherId, setClaimedVoucherId] = useState<string | null>(null);
  const [justDrawn, setJustDrawn] = useState<Record<string, number>>({});
  const batchKey = useRef(newKey());
  const pendingId = claimOne.isPending ? claimOne.variables : null;

  const clearClaimedVoucherId = useCallback(() => {
    setClaimedVoucherId(null);
  }, []);

  const runClaim = useCallback(
    async (promotionId: string) => {
      const r = await claimOne.mutateAsync(promotionId).catch(() => null);
      if (!r) return toast.push("Mất kết nối, vui lòng thử lại.");
      if (!r.ok) return toast.push(r.error);
      if (r.drawnPercent) setJustDrawn((m) => ({ ...m, [promotionId]: r.drawnPercent! }));
      if (r.already) {
        const msg = r.drawnPercent
          ? `Bạn đã bóc túi này rồi: giảm ${r.drawnPercent}%`
          : r.message || "Bạn đã lưu voucher này vào ví rồi";
        toast.push(msg, { href: "/tai-khoan?tab=voucher", hrefLabel: "Xem ví" });
      } else {
        setClaimedVoucherId(promotionId);
      }
      onClaimedRef.current?.();
    },
    [claimOne, toast]
  );

  const runClaimAll = useCallback(async () => {
    const r = await claimAll.mutateAsync(batchKey.current).catch(() => null);
    batchKey.current = newKey();
    if (!r) return toast.push("Mất kết nối, vui lòng thử lại.");
    if (!r.ok) return toast.push(r.error);
    const opened = r.results.filter((x) => x.ok && !x.already && x.drawnPercent);
    if (opened.length) {
      setJustDrawn((m) => ({
        ...m,
        ...Object.fromEntries(opened.map((x) => [x.promotionId, (x.ok && x.drawnPercent) || 0])),
      }));
      setClaimedVoucherId(opened[0].promotionId);
    }
    toast.push(r.message);
    onClaimedRef.current?.();
  }, [claimAll, toast]);

  const claim = (promotionId: string) => {
    if (!user) {
      setPendingIntent({ type: "claim", promotionId });
      setLoginOpen(true);
      return;
    }
    void runClaim(promotionId);
  };

  const collectAll = () => {
    if (claimAll.isPending) return;
    if (!user) {
      setPendingIntent({ type: "claimAll" });
      setLoginOpen(true);
      return;
    }
    void runClaimAll();
  };

  const prevUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = user?.id || null;
    const changed = prevUserId.current !== undefined && prevUserId.current !== id;
    prevUserId.current = id;
    if (!id) return;
    if (changed) {
      void qc.invalidateQueries({ queryKey: CURRENT_CAMPAIGN_KEY });
      void qc.invalidateQueries({ queryKey: WALLET_KEY });
    }
    const intent = takePendingIntent();
    if (intent?.type === "claim") void runClaim(intent.promotionId);
    else if (intent?.type === "claimAll") void runClaimAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unopened = new Set((wallet.data?.unopened || []).filter((id) => !justDrawn[id]));

  return {
    /** Túi mù đang giữ mà chưa bóc không tính là đã lưu → nút hiện "Bóc ngay". */
    claimedIds: new Set((wallet.data?.claimedIds || []).filter((id) => !unopened.has(id))),
    /** Voucher túi mù đã bóc: promotionId → % trúng. */
    drawn: { ...wallet.data?.drawn, ...justDrawn },
    claim,
    collectAll,
    pendingId,
    collecting: claimAll.isPending,
    loginOpen,
    /** Đóng bảng đăng nhập khi khách bỏ ngang → huỷ ý định để không tự lưu bất ngờ về sau. */
    cancelLogin: () => {
      takePendingIntent();
      setLoginOpen(false);
    },
    loginDone: () => setLoginOpen(false),
    claimedVoucherId,
    clearClaimedVoucherId,
  };
}
