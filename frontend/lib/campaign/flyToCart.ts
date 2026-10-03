/** Phần tử giỏ hàng đích (header, tab bar, thanh ship) gắn thuộc tính này. */
export const CART_TARGET_ATTR = "data-cart-target";

function visibleTarget(): HTMLElement | null {
  const list = Array.from(document.querySelectorAll<HTMLElement>(`[${CART_TARGET_ATTR}]`));
  return (
    list.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }) || null
  );
}

/** Ảnh SP bay vào biểu tượng giỏ rồi giỏ nảy nhẹ; tắt khi máy bật giảm chuyển động. */
export function flyToCart(source: HTMLElement | null, imageUrl: string): void {
  if (typeof window === "undefined" || !source) return;
  const target = visibleTarget();
  if (!target) return;
  const bump = () => {
    target.classList.remove("aloha-cart-bump");
    void target.offsetWidth;
    target.classList.add("aloha-cart-bump");
  };
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !imageUrl) {
    bump();
    return;
  }
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 140);
  const ghost = document.createElement("img");
  ghost.src = imageUrl;
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    borderRadius: "16px",
    zIndex: "9999",
    pointerEvents: "none",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  });
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(0.6)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.6 },
    ],
    { duration: 700, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)" }
  );
  const done = () => {
    ghost.remove();
    bump();
  };
  anim.onfinish = done;
  anim.oncancel = done;
}
