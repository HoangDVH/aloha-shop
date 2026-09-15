"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "../api";
import { datetimeLocalToIso } from "@/lib/webKmForm";

/** Áp / gỡ giảm giá % cho toàn bộ SP đang hiện web. */
export function WebKmBulkBar({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [phanTram, setPhanTram] = useState(10);
  const [tu, setTu] = useState("");
  const [den, setDen] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [mode, setMode] = useState<"apply" | "clear">("apply");

  const mut = useMutation({
    mutationFn: async () => {
      if (mode === "apply" && !(phanTram >= 1 && phanTram <= 99)) {
        throw new Error("Chọn % giảm từ 1–99");
      }
      if (mode === "apply" && !confirmOverwrite) {
        throw new Error("Tick xác nhận ghi đè KM hiện có");
      }
      return websiteApi<{
        ok: boolean;
        updated: number;
        skippedCount: number;
      }>("/api/shop/admin/products/web-km/bulk", {
        method: "POST",
        body: JSON.stringify({
          mode,
          phanTram: mode === "apply" ? phanTram : undefined,
          tu: datetimeLocalToIso(tu),
          den: datetimeLocalToIso(den),
        }),
      });
    },
    onSuccess: (r) => {
      toast.success(
        mode === "clear"
          ? `Đã gỡ giảm giá ${r.updated} SP` +
              (r.skippedCount ? ` · bỏ qua ${r.skippedCount}` : "")
          : `Đã áp giảm ${phanTram}% cho ${r.updated} SP` +
              (r.skippedCount ? ` · bỏ qua ${r.skippedCount}` : "")
      );
      setOpen(false);
      setConfirmOverwrite(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Bulk thất bại"),
  });

  return (
    <div className="rounded-lg border border-dashed border-[#D4CDC0] bg-[#FBF8F1] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-gray-800">
            {mode === "clear" ? "Gỡ giảm giá hàng loạt" : "Áp giảm giá hàng loạt"}
          </p>
          <p className="text-[11px] text-gray-500">
            Chọn % để áp cho tất cả SP đang bán web
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-8 rounded-md border border-gray-200 bg-white px-3 text-[12px] font-semibold text-[#3D6B3A]"
        >
          {open ? "Thu gọn" : "Mở"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 border-t border-[#E8E2D6] pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("apply")}
              className={`h-8 rounded-md px-3 text-[12px] font-semibold ${
                mode === "apply"
                  ? "bg-[#3D6B3A] text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200"
              }`}
            >
              Áp %
            </button>
            <button
              type="button"
              onClick={() => setMode("clear")}
              className={`h-8 rounded-md px-3 text-[12px] font-semibold ${
                mode === "clear"
                  ? "bg-slate-700 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200"
              }`}
            >
              Gỡ tất cả KM
            </button>
          </div>

          {mode === "apply" ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[12px] text-gray-600">
                Giảm (%)
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={phanTram}
                  onChange={(e) => setPhanTram(Math.round(Number(e.target.value) || 0))}
                  className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px]"
                />
              </label>
              <label className="text-[12px] text-gray-600">
                Bắt đầu
                <input
                  type="datetime-local"
                  value={tu}
                  onChange={(e) => setTu(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px]"
                />
              </label>
              <label className="text-[12px] text-gray-600">
                Kết thúc
                <input
                  type="datetime-local"
                  value={den}
                  onChange={(e) => setDen(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px]"
                />
              </label>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-[12px] text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmOverwrite}
              onChange={(e) => setConfirmOverwrite(e.target.checked)}
            />
            <span>
              {mode === "apply"
                ? `Xác nhận: giảm ${phanTram}% (tính theo tham chiếu 30 ngày) cho mọi SP đang hiện web — có thể ghi đè KM cũ.`
                : "Xác nhận gỡ giảm giá trên mọi SP đang hiện web."}
            </span>
          </label>

          <button
            type="button"
            disabled={mut.isPending || !confirmOverwrite}
            onClick={() => mut.mutate()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3D6B3A] px-3.5 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {mode === "clear" ? "Gỡ giảm giá hàng loạt" : "Áp giảm giá hàng loạt"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
