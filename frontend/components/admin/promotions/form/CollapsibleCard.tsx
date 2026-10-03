"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  title: ReactNode;
  children: ReactNode;
  /** Truyền cả hai để điều khiển từ ngoài (ví dụ mở khối khi báo lỗi). */
  collapsed?: boolean;
  onToggle?: () => void;
  bodyClassName?: string;
};

/** Khối xổ ra kiểu KiotViet dùng trong form voucher. */
export function CollapsibleCard({ title, children, collapsed, onToggle, bodyClassName }: Props) {
  const [innerCollapsed, setInnerCollapsed] = useState(false);
  const isCollapsed = collapsed ?? innerCollapsed;
  const toggle = onToggle ?? (() => setInnerCollapsed((v) => !v));
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
      <div
        onClick={toggle}
        className="flex items-center justify-between cursor-pointer font-bold text-slate-800 text-sm pb-2 border-b border-slate-100 select-none"
      >
        <span>{title}</span>
        {isCollapsed ? (
          <ChevronDown size={18} className="text-slate-400" />
        ) : (
          <ChevronUp size={18} className="text-slate-400" />
        )}
      </div>
      {!isCollapsed && (
        <div className={bodyClassName ?? "pt-3.5 space-y-3.5 text-xs text-slate-700"}>{children}</div>
      )}
    </div>
  );
}
