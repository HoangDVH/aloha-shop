"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  error?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ id, label, error, className, ...inputProps }, ref) {
    const [show, setShow] = useState(false);

    return (
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor={id}>
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? "text" : "password"}
            className={`auth-field pr-11 ${className || ""}`}
            {...inputProps}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--aloha-green)]"
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={show}
          >
            {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
      </div>
    );
  }
);
