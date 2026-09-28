import React from "react";
import type { ShopAccount } from "./accountsApi";

export function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "orange" | "gray" | "red";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "orange"
        ? "bg-orange-50 text-orange-700"
        : tone === "red"
          ? "bg-red-50 text-red-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

/** Nhãn trạng thái CTV — ghi rõ tiếng Việt như mockup */
export function ctvStatusChip(row: ShopAccount): {
  label: string;
  tone: "green" | "orange" | "red" | "gray";
} {
  if (!row.active || row.ctvStatus === "khoa") {
    return { label: "Tạm dừng", tone: "red" };
  }
  if (row.ctvStatus === "active") {
    return { label: "Hoạt động", tone: "green" };
  }
  if (row.ctvStatus === "cho_duyet") {
    return { label: "Chờ duyệt", tone: "orange" };
  }
  if (row.ctvStatus === "tu_choi") {
    return { label: "Từ chối", tone: "red" };
  }
  return { label: "Hoạt động", tone: "green" };
}
