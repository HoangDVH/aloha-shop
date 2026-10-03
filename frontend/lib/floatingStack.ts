"use client";

import { useCallback, useEffect, useRef } from "react";

/** Chiều cao thanh dính đáy của trang (thanh mua PDP, thanh giỏ, thanh ship) để nút nổi đứng phía trên. */
export const STICKY_BAR_VAR = "--shop-sticky-h";

/**
 * Callback ref cho thanh dính đáy: đo chiều cao thật (đổi theo nội dung / màn hình) và ghi vào biến CSS gốc;
 * thanh gỡ khỏi trang thì xoá biến. Thanh ẩn trên desktop (`lg:hidden`) đo ra 0 nên nút nổi tự về góc.
 */
export function useStickyBarHeight<T extends HTMLElement>() {
  const observer = useRef<ResizeObserver | null>(null);

  const detach = () => {
    observer.current?.disconnect();
    observer.current = null;
    document.documentElement.style.removeProperty(STICKY_BAR_VAR);
  };

  useEffect(() => detach, []);

  return useCallback((el: T | null) => {
    detach();
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty(STICKY_BAR_VAR, `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver !== "undefined") {
      observer.current = new ResizeObserver(apply);
      observer.current.observe(el);
    }
  }, []);
}
