"use client";

import React, { useEffect, useState } from "react";
import { toast } from "@/components/admin/toast";
import { api } from "./api";

export function SettingsPanel({
  settings,
  onSaved,
}: {
  settings: any;
  onSaved: (s: any) => void;
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(settings), [settings]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-bold text-slate-800">Cấu hình hoa hồng</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["defaultCommissionRate", "% mặc định shop"],
            ["returnHoldDays", "Ngày giữ sau giao"],
            ["attributionWindowDays", "Cửa sổ click (ngày)"],
            ["settleDay", "Ngày gợi ý chốt kỳ"],
            ["selfBuyMaxHits", "Ngưỡng tự mua"],
            ["addressMatchMaxHits", "Ngưỡng cảnh báo trùng SĐT"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-[12px] font-semibold text-slate-600">
            {label}
            <input
              type="number"
              value={form[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block text-[12px] font-semibold text-slate-600">
        Whitelist SĐT test/nội bộ (phẩy hoặc xuống dòng)
        <textarea
          value={
            form.phoneWhitelistText ??
            (Array.isArray(form.phoneWhitelist)
              ? form.phoneWhitelist.join(", ")
              : "123456789, 0123456789")
          }
          onChange={(e) =>
            setForm({ ...form, phoneWhitelistText: e.target.value })
          }
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
      </label>
      <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-slate-600">
        <input
          type="checkbox"
          checked={form.phoneRepeatSoftWarn !== false}
          onChange={(e) =>
            setForm({ ...form, phoneRepeatSoftWarn: e.target.checked })
          }
        />
        Bật cảnh báo mềm trùng SĐT (không tự khóa hoa hồng)
      </label>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          onClick={async () => {
            setSaving(true);
            try {
              const r = await api<{ settings: any }>("/api/shop/admin/ctv/settings", {
                method: "PATCH",
                body: JSON.stringify(form),
              });
              setForm(r.settings);
              onSaved(r.settings);
            } catch (e: any) {
              toast.error(e?.message || "Lưu thất bại");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
      </div>
    </div>
  );
}
