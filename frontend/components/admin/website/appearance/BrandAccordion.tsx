"use client";

import React, { type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { WB } from "../ui";

export type BrandSectionId = "color" | "identity" | "seo" | "popup";

type RowProps = {
  id: BrandSectionId;
  label: string;
  hint?: string;
  Icon: LucideIcon;
  open: boolean;
  primary: string;
  onToggle: () => void;
  children: ReactNode;
};

function BrandRow({
  label,
  hint,
  Icon,
  open,
  primary,
  onToggle,
  children,
}: RowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="group flex h-11 w-full items-center gap-2 rounded-xl px-2 text-left transition"
        style={{
          background: open ? WB.rowActive : "transparent",
          boxShadow: open ? `inset 0 0 0 1px ${primary}33` : undefined,
          border: "none",
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: open ? `${primary}18` : "#F0F2F5",
            color: open ? primary : "#6B7280",
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-gray-800">
            {label}
          </span>
          {hint ? (
            <span className="block truncate text-[11px] text-gray-400">{hint}</span>
          ) : null}
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open ? (
        <div className="mb-1 mt-1.5 space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
          {children}
        </div>
      ) : null}
    </li>
  );
}

export function BrandAccordion({
  openId,
  onOpen,
  primary,
  items,
}: {
  openId: BrandSectionId | null;
  onOpen: (id: BrandSectionId | null) => void;
  primary: string;
  items: {
    id: BrandSectionId;
    label: string;
    hint?: string;
    Icon: LucideIcon;
    body: ReactNode;
  }[];
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <BrandRow
          key={item.id}
          id={item.id}
          label={item.label}
          hint={item.hint}
          Icon={item.Icon}
          open={openId === item.id}
          primary={primary}
          onToggle={() => onOpen(openId === item.id ? null : item.id)}
        >
          {item.body}
        </BrandRow>
      ))}
    </ul>
  );
}
