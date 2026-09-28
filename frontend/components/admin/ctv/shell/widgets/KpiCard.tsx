"use client";

import React from "react";
import { changeTag } from "../format";

export function KpiCard({
  title,
  value,
  icon,
  change,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  change?: number | null;
}) {
  return (
    <div className="flex h-full min-h-[118px] flex-col rounded-xl border border-[#e8ece8] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8EFE4] text-[#2D5A27]">
          {icon}
        </div>
        <p className="m-0 min-w-0 flex-1 truncate text-[12px] font-semibold leading-snug text-slate-500">
          {title}
        </p>
      </div>
      <p className="mb-0 mt-3 truncate text-[20px] font-extrabold leading-none tracking-tight text-[#1a2e1a] tabular-nums sm:text-[22px]">
        {value}
      </p>
      <div className="mt-auto pt-2.5">{changeTag(change)}</div>
    </div>
  );
}
