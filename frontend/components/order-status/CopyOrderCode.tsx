"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyOrderCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5D5C0] bg-white px-2.5 py-1 text-xs font-bold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Đã chép" : "Sao chép"}
    </button>
  );
}
