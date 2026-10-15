"use client";

import { useEffect, useRef, useState } from "react";

/** Keep the last server-confirmed display value while a replacement is pending.
 * The scope prevents a previous customer's prices from appearing after an account switch.
 * This value is for display only; submission must use the current validated quote.
 */
export function usePendingValue<T>(value: T, pending: boolean, scope = ""): T | null {
  const confirmed = useRef<{ scope: string; value: T } | null>(null);
  useEffect(() => {
    if (!pending) confirmed.current = { scope, value };
    else if (confirmed.current?.scope !== scope) confirmed.current = null;
  }, [value, pending, scope]);
  return pending ? confirmed.current?.scope === scope ? confirmed.current.value : null : value;
}

/** Avoid flashing a spinner for responses that finish in under 200ms. */
export function useDelayedPending(pending: boolean, delay = 200) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!pending) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [pending, delay]);
  return pending && visible;
}
