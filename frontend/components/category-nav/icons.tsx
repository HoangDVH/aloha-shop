import React from "react";

export function IconPot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7.5 9.5h9l-1.2 9.2a1.5 1.5 0 0 1-1.5 1.3h-3.6a1.5 1.5 0 0 1-1.5-1.3L7.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 9.5h11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9 9.5V8.2A2.2 2.2 0 0 1 11.2 6h1.6A2.2 2.2 0 0 1 15 8.2V9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconVase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.5 4.5h5M10.2 4.5c0 2.2-1.4 3.6-1.8 5.4-.6 2.6.2 6.8 1.8 8.6.5.6 1.2.9 2 .9s1.5-.3 2-.9c1.6-1.8 2.4-6 1.8-8.6-.4-1.8-1.8-3.2-1.8-5.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSproutBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="5.5"
        y="12.5"
        width="13"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 12.5V9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 9.8c-1.6-1.8-3.8-2.2-5-2 .4 1.8 2.2 3.4 4.2 3.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.8c1.6-1.8 3.8-2.2 5-2-.4 1.8-2.2 3.4-4.2 3.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ICON_CLASS = "h-[18px] w-[18px] shrink-0";
