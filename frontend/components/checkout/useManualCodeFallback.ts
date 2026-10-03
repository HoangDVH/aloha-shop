"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import type { PromotionQuoteUI } from "./PromotionModal";

/**
 * Mã khách tự chọn được giữ nguyên; chỉ khi mã đó đã từng áp được rồi mất hiệu lực (giỏ đổi)
 * mới quay về tự áp mã tốt nhất. Mã nhập sai lần đầu vẫn để nguyên để modal báo lỗi.
 */
export function useManualCodeFallback(args: {
  quote: PromotionQuoteUI | null;
  code: string;
  autoMode: boolean;
  fallback: () => void;
}) {
  const { quote, code, autoMode, fallback } = args;
  const toast = useToast();
  const appliedCode = useRef("");

  useEffect(() => {
    if (autoMode || !code) {
      appliedCode.current = "";
      return;
    }
    if (!quote) return;
    if (quote.applied?.code === code) {
      appliedCode.current = code;
      return;
    }
    if (appliedCode.current !== code) return;
    appliedCode.current = "";
    toast.push(`Mã ${code} không còn đủ điều kiện, đã chọn ưu đãi tốt nhất cho bạn.`);
    fallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, code, autoMode]);
}
