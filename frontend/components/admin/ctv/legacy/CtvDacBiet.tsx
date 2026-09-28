"use client";

import React, { useCallback, useState } from "react";
import { toast } from "@/components/admin/toast";
import { api } from "./api";

export function CtvDacBiet() {
  const [ctvCode, setCtvCode] = useState("");
  const [ma, setMa] = useState("");
  const [rate, setRate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [queriedCode, setQueriedCode] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const code = ctvCode.trim().toUpperCase();
    if (!code) {
      toast.error("Nhập mã CTV trước");
      return;
    }
    if (code.length < 3) {
      toast.error("Mã CTV tối thiểu 3 ký tự");
      return;
    }
    setLoading(true);
    try {
      const r = await api<{ data: any[] }>(
        `/api/shop/admin/ctv/overrides?ctvCode=${encodeURIComponent(code)}`
      );
      const list = r.data || [];
      setRows(list);
      setQueriedCode(code);
      if (!list.length) {
        toast.success(`Đã xem ${code}: chưa có % đặc biệt`);
      }
    } catch (e: any) {
      setRows([]);
      setQueriedCode("");
      const msg = String(e?.message || "");
      toast.error(
        msg === "invalid_ctv"
          ? "Mã CTV không hợp lệ (3–20 ký tự A-Z, 0-9, _, -)"
          : msg || "Lỗi tải override"
      );
    } finally {
      setLoading(false);
    }
  }, [ctvCode]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm text-slate-500">
        Gán % cao hơn cho cặp CTV + sản phẩm (Target Campaign). Đây là{" "}
        <b>mã CTV</b> (vd. trên hồ sơ CTV), không phải họ tên.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder="Mã CTV"
          value={ctvCode}
          onChange={(e) => setCtvCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void load();
            }
          }}
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase"
        />
        <button
          type="button"
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          onClick={() => void load()}
        >
          {loading ? "Đang xem…" : "Xem override"}
        </button>
        <input
          placeholder="Mã SP"
          value={ma}
          onChange={(e) => setMa(e.target.value.toUpperCase())}
          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="%"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
          onClick={async () => {
            try {
              await api("/api/shop/admin/ctv/overrides", {
                method: "PUT",
                body: JSON.stringify({
                  ctvCode: ctvCode.trim().toUpperCase(),
                  ma: ma.trim().toUpperCase(),
                  rate: Number(rate),
                }),
              });
              toast.success("Đã lưu");
              void load();
            } catch (e: any) {
              toast.error(e?.message || "Lỗi (kiểm tra % ≥ mức mở)");
            }
          }}
        >
          Thêm / sửa
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={`${r.ctvCode}-${r.ma}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              <b>{r.ma}</b> · {r.rate}%
            </span>
            <button
              type="button"
              className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
              onClick={async () => {
                await api("/api/shop/admin/ctv/overrides", {
                  method: "DELETE",
                  body: JSON.stringify({ ctvCode: r.ctvCode, ma: r.ma }),
                });
                toast.success("Đã xóa");
                void load();
              }}
            >
              Xóa
            </button>
          </div>
        ))}
        {!rows.length ? (
          <p className="text-sm text-slate-400">
            {queriedCode
              ? `CTV ${queriedCode} chưa có override. Điền Mã SP + % rồi bấm Thêm / sửa.`
              : "Nhập mã CTV rồi bấm «Xem override» (chỉ nhập mã chưa tải được danh sách)."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
