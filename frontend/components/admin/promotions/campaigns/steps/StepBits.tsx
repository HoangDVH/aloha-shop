"use client";

import type { ReactNode } from "react";
import { Tooltip } from "antd";
import { HelpCircle, Lock } from "lucide-react";

export function FieldBox({
  label,
  hint,
  errors = [],
  children,
  required,
  extra,
}: {
  label: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
  required?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <span>{label}</span>
          {required ? <span className="text-rose-500">*</span> : null}
          {hint ? (
            <Tooltip title={hint} placement="top" arrow>
              <span className="inline-flex cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={14} />
              </span>
            </Tooltip>
          ) : null}
        </label>
        {extra ? <div className="text-[11px] text-slate-400 font-medium">{extra}</div> : null}
      </div>
      {children}
      {errors.length ? (
        <p className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-600" />
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function LockedNote() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 ring-1 ring-amber-200">
      <Lock size={14} /> Chỉ quản lý được sửa giá, số lượng, quà, voucher và thời gian. Bạn vẫn sửa được chữ và hình ảnh.
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-slate-100 pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {hint ? (
            <Tooltip title={hint} placement="top" arrow overlayStyle={{ maxWidth: 420 }}>
              <span className="inline-flex cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={15} />
              </span>
            </Tooltip>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
