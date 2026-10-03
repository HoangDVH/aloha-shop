"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PromotionQuoteUI } from "@/components/checkout/PromotionModal";
import { requestPromotionQuote, type PromotionQuoteRequest } from "./promotions";

const DEBOUNCE_MS = 300;
const RETRY_MS = [2000, 5000, 10000, 20000];

type QuoteLine = { ma: string; ten?: string; gia: number; qty: number };

const isTransient = (status: number) => status === 0 || status === 429 || status >= 500;

/**
 * Báo giá ưu đãi + quà chiến dịch cho giỏ / trang xác nhận.
 * Bấm +/- liên tục chỉ gửi 1 lần sau khi dừng tay; lỗi tạm thời (429, mất mạng) giữ báo giá cũ
 * (`stale`) và tự gọi lại, để quà tặng / tiền giảm không biến mất giữa chừng.
 */
export function usePromotionQuote(input: {
  lines: QuoteLine[];
  selectedCode: string;
  autoMode: boolean;
  phone?: string | null;
  email?: string | null;
  refreshKey: string | number;
}): { quote: PromotionQuoteUI | null; loading: boolean; stale: boolean } {
  const { lines, selectedCode, autoMode, phone, email, refreshKey } = input;
  const [quote, setQuote] = useState<PromotionQuoteUI | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const hasQuote = useRef(false);

  const requestKey = useMemo(() => {
    if (!lines.length) return "";
    const body: PromotionQuoteRequest = {
      items: lines.map((l) => ({ ma: l.ma, ten: l.ten, price: l.gia, quantity: l.qty })),
      selectedCode,
      autoMode,
      phone: phone || undefined,
      email: email || undefined,
    };
    return JSON.stringify(body);
  }, [lines, selectedCode, autoMode, phone, email]);

  useEffect(() => {
    if (!requestKey) {
      hasQuote.current = false;
      setQuote(null);
      setStale(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);

    const run = async (attempt: number) => {
      const r = await requestPromotionQuote(JSON.parse(requestKey) as PromotionQuoteRequest, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r.ok) {
        hasQuote.current = true;
        setQuote(r.quote);
        setStale(false);
        setLoading(false);
        return;
      }
      if (isTransient(r.status) && attempt < RETRY_MS.length) {
        setStale(hasQuote.current);
        timer = setTimeout(() => void run(attempt + 1), RETRY_MS[attempt]);
        return;
      }
      setStale(hasQuote.current);
      setLoading(false);
    };

    timer = setTimeout(() => void run(0), hasQuote.current ? DEBOUNCE_MS : 0);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [requestKey, refreshKey]);

  return { quote, loading, stale };
}
