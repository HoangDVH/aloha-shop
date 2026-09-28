"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/admin/toast";
import { api } from "./api";

export function CanhBao({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await api<{ data: any[] }>("/api/shop/admin/ctv/fraud?limit=50");
      setRows(r.data || []);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm shadow-sm"
        >
          <div className="font-bold text-slate-800">
            {r.type} · {r.ctvCode}
            {r.displayOrderCode || r.orderCode
              ? ` · ${r.displayOrderCode || r.orderCode}`
              : ""}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {(r.details || []).join(" · ") || "—"} ·{" "}
            {(r.createdAt || "").slice(0, 16).replace("T", " ")}
          </div>
          <button
            type="button"
            className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700"
            onClick={async () => {
              const ok = window.confirm(
                `Khóa CTV ${r.ctvCode} và hủy mọi hoa hồng chưa chi?`
              );
              if (!ok) return;
              try {
                await api(`/api/shop/admin/ctv/${encodeURIComponent(r.ctvCode)}/ban`, {
                  method: "POST",
                  body: JSON.stringify({ reason: r.type || "fraud" }),
                });
                toast.success("Đã khóa CTV");
                onDone();
                void load();
              } catch (e: any) {
                toast.error(e?.message || "Lỗi");
              }
            }}
          >
            Khóa cộng tác viên & hủy hoa hồng chưa chi
          </button>
        </div>
      ))}
      {!rows.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Chưa có cảnh báo.
        </p>
      ) : null}
    </div>
  );
}
