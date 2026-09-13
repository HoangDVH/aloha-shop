"use client";

import type { ShopUser } from "@/lib/auth";

function initialOf(user: Pick<ShopUser, "fullName" | "email">): string {
  const name = String(user.fullName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1] || name;
    return last.charAt(0).toUpperCase();
  }
  return String(user.email || "?").charAt(0).toUpperCase();
}

export function AccountAvatar({
  user,
  size = 36,
  className = "",
}: {
  user: Pick<ShopUser, "fullName" | "email" | "avatarUrl" | "authProviders">;
  size?: number;
  className?: string;
}) {
  const letter = initialOf(user);
  const px = `${size}px`;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: px, height: px }}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="h-full w-full rounded-full object-cover ring-2 ring-white/40"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-[#7C4DFF] text-white ring-2 ring-white/40"
          style={{ fontSize: Math.max(12, Math.round(size * 0.42)), fontWeight: 800 }}
        >
          {letter}
        </span>
      )}
    </span>
  );
}
