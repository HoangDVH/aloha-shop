"use client";

import { useEffect, useState, type RefObject } from "react";

export function useScrollHeader(ref: RefObject<HTMLElement | null>, menuOpen: boolean, route: string) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    let anchor = Math.max(0, window.scrollY);
    let previous = anchor;
    let direction = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const header = ref.current;
      const nextDirection = Math.sign(y - previous);
      if (nextDirection && nextDirection !== direction) {
        anchor = previous;
        direction = nextDirection;
      }
      previous = y;
      const engaged = menuOpen || header?.contains(document.activeElement) ||
        Boolean(header?.querySelector('[aria-expanded="true"]'));
      if (engaged || y <= (header?.offsetHeight || 160)) {
        setHidden(false);
        anchor = y;
      } else if (Math.abs(y - anchor) >= 12) {
        setHidden(direction > 0);
        anchor = y;
      }
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [ref, menuOpen, route]);

  return hidden;
}
