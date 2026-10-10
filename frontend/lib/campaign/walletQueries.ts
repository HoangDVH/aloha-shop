"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CURRENT_CAMPAIGN_KEY } from "./campaignQueries";
import { useHydratedQuery } from "../useHydratedQuery";
import {
  claimAllVouchers,
  claimVoucher,
  fetchWallet,
  type ClaimBatchResponse,
  type ClaimResponse,
  type WalletResponse,
} from "./walletApi";

export const WALLET_KEY = ["shop", "vouchers", "wallet"] as const;

/** Ví của khách; tải lại khi quay lại tab để tab khác thấy "Đã lưu". */
export function useWallet(enabled = true) {
  return useHydratedQuery(useQuery({
    queryKey: WALLET_KEY,
    queryFn: fetchWallet,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  }));
}

function patchClaimed(qc: ReturnType<typeof useQueryClient>, add: string[], remove: string[] = []) {
  qc.setQueryData<WalletResponse>(WALLET_KEY, (old) => {
    const base = old || { ok: true, enabled: true, items: [], claimedIds: [] };
    const set = new Set(base.claimedIds);
    add.forEach((id) => set.add(id));
    remove.forEach((id) => set.delete(id));
    return { ...base, claimedIds: [...set] };
  });
}

/** Lưu 1 mã: hiện "Đã lưu" ngay, lỗi thì hoàn lại và trả lỗi để hiện lý do. */
export function useClaimVoucher() {
  const qc = useQueryClient();
  return useMutation<ClaimResponse, Error, string, { had: boolean }>({
    mutationFn: claimVoucher,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: WALLET_KEY });
      const had = Boolean(qc.getQueryData<WalletResponse>(WALLET_KEY)?.claimedIds.includes(id));
      patchClaimed(qc, [id]);
      return { had };
    },
    onSuccess: (res, id, ctx) => {
      if (!res.ok && !ctx?.had) patchClaimed(qc, [], [id]);
    },
    onError: (_e, id, ctx) => {
      if (!ctx?.had) patchClaimed(qc, [], [id]);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: WALLET_KEY });
      void qc.invalidateQueries({ queryKey: CURRENT_CAMPAIGN_KEY });
    },
  });
}

export function useClaimAll() {
  const qc = useQueryClient();
  return useMutation<ClaimBatchResponse, Error, string>({
    mutationFn: claimAllVouchers,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: WALLET_KEY });
      void qc.invalidateQueries({ queryKey: CURRENT_CAMPAIGN_KEY });
    },
  });
}
