"use client";

import { useRef, useState } from 'react';

export function useQuoteSubmission() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const busy = useRef(false);

  const submit = async (input: Record<string, string>) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const body = JSON.stringify(input);
      if (attempt.current?.body !== body) attempt.current = { body, id: crypto.randomUUID() };
      const response = await fetch('/api/shop/quote-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ ...input, requestId: attempt.current.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.id) throw new Error(data.error || 'Chưa gửi được yêu cầu. Vui lòng thử lại.');
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi kết nối. Vui lòng thử lại.');
    } finally { busy.current = false; setLoading(false); }
  };

  const reset = () => { attempt.current = null; setSent(false); setError(''); };
  return { loading, sent, error, submit, reset };
}
