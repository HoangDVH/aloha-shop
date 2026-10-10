"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";

export function StorefrontScrollEffects() {
  const pathname = usePathname();
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observed = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        if (motion.matches || !entry.target.animate) continue;
        const animation = entry.target.animate([
          { opacity: 0.35, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 250, easing: "ease-out" });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" }) : null;
    const scan = () => document.querySelectorAll('[data-scroll-reveal]').forEach(el => {
      if (!observed.has(el)) { observed.add(el); observer?.observe(el); }
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.querySelector('.shop-storefront-with-tabbar') || document.body, { childList: true, subtree: true });
    const onMotion = () => { if (motion.matches) animations.forEach(animation => animation.cancel()); };
    motion.addEventListener("change", onMotion);
    const onScroll = () => setShowTop(window.scrollY > Math.max(600, window.innerHeight));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect(); mutations.disconnect();
      animations.forEach(animation => animation.cancel());
      motion.removeEventListener("change", onMotion);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);
  return showTop ? <button type="button" aria-label="Lên đầu trang" title="Lên đầu trang"
    onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
    className="fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-[var(--aloha-green)] shadow-md transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)] lg:right-6"
    style={{ bottom: "calc(var(--shop-float-bottom, 24px) + 72px)" }}><ArrowUp size={20} aria-hidden="true" /></button> : null;
}
