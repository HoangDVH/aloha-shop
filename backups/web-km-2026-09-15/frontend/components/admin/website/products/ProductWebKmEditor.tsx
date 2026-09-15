"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, X } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { ProductPrice } from "@/components/ProductPrice";
import { websiteApi } from "../api";
import {
  computePhanTramGiam,
  datetimeLocalToIso,
  isoToDatetimeLocal,
  kmStatusChip,
  priceFromPercent,
  webKmFormSchema,
  type WebKmFormValues,
} from "@/lib/webKmForm";

export type AdminProductKmRow = {
  ma: string;
  ten: string;
  anh?: string;
  gia: number;
  giaWeb?: number;
  giaThamChieu?: number;
  giaWebTangAo?: boolean;
  dangKm?: boolean;
  giaGoc?: number;
  phanTramGiam?: number;
  webKm?: {
    gia?: number;
    phanTram?: number;
    tu?: string;
    den?: string;
  } | null;
};

function fmtVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")} ₫`;
}

type Props = {
  row: AdminProductKmRow;
  onClose: () => void;
  onSaved: (patch: Partial<AdminProductKmRow>) => void;
};

export function ProductWebKmEditor({ row, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const giaWeb = Number(row.giaWeb ?? row.gia) || 0;
  const giaThamChieu = Number(row.giaThamChieu ?? giaWeb) || 0;
  const chip = kmStatusChip({
    webKm: row.webKm,
    dangKm: row.dangKm,
  });

  const form = useForm<WebKmFormValues>({
    resolver: zodResolver(webKmFormSchema) as any,
    defaultValues: {
      gia: row.webKm?.gia || (giaThamChieu > 0 ? Math.round(giaThamChieu * 0.9) : 0),
      phanTram:
        row.webKm?.phanTram ||
        (row.webKm?.gia && giaThamChieu
          ? computePhanTramGiam(giaThamChieu, Number(row.webKm.gia))
          : 10),
      tu: isoToDatetimeLocal(row.webKm?.tu),
      den: isoToDatetimeLocal(row.webKm?.den),
    },
  });

  const watchGia = Number(form.watch("gia")) || 0;
  const watchPct = Number(form.watch("phanTram")) || 0;
  const watchTu = form.watch("tu");
  const watchDen = form.watch("den");

  useEffect(() => {
    form.reset({
      gia: row.webKm?.gia || (giaThamChieu > 0 ? Math.round(giaThamChieu * 0.9) : 0),
      phanTram:
        row.webKm?.phanTram ||
        (row.webKm?.gia && giaThamChieu
          ? computePhanTramGiam(giaThamChieu, Number(row.webKm.gia))
          : 10),
      tu: isoToDatetimeLocal(row.webKm?.tu),
      den: isoToDatetimeLocal(row.webKm?.den),
    });
  }, [row.ma, row.webKm, giaThamChieu, form]);

  const previewPct =
    watchGia > 0 && giaThamChieu > watchGia
      ? computePhanTramGiam(giaThamChieu, watchGia)
      : 0;
  const previewOk = watchGia > 0 && giaThamChieu > 0 && watchGia < giaThamChieu;
  const softWarnLow = previewOk && previewPct > 0 && previewPct < 5;
  const softWarnHigh = previewOk && previewPct > 50;

  const previewScheduleNote = useMemo(() => {
    const tu = watchTu ? Date.parse(String(watchTu)) : NaN;
    const den = watchDen ? Date.parse(String(watchDen)) : NaN;
    const now = Date.now();
    if (Number.isFinite(tu) && now < tu) {
      return "Chưa bắt đầu — khách đang thấy giá gốc";
    }
    if (Number.isFinite(den) && now > den) {
      return "Đã hết lịch — khách đang thấy giá gốc";
    }
    return null;
  }, [watchTu, watchDen]);

  const historyQ = useQuery({
    queryKey: ["shop-admin-price-history", row.ma],
    enabled: showHistory,
    queryFn: () =>
      websiteApi<{
        points: Array<{
          gia: number;
          at: string;
          by?: string;
          giaWeb?: number;
          giaKm?: number | null;
          phanTram?: number | null;
        }>;
        rows?: Array<{
          gia: number;
          at: string;
          by?: string;
          giaWeb?: number;
          giaKm?: number | null;
          phanTram?: number | null;
        }>;
        giaThamChieu: number;
      }>(`/api/shop/admin/products/${encodeURIComponent(row.ma)}/price-history`),
  });

  const saveMut = useMutation({
    mutationFn: async (values: WebKmFormValues) => {
      const payload = {
        webKm: {
          gia: Math.round(Number(values.gia)),
          phanTram:
            values.phanTram != null && Number(values.phanTram) > 0
              ? Math.round(Number(values.phanTram))
              : undefined,
          tu: datetimeLocalToIso(values.tu),
          den: datetimeLocalToIso(values.den),
        },
      };
      return websiteApi<AdminProductKmRow & { ok: boolean; error?: string }>(
        `/api/shop/admin/products/${encodeURIComponent(row.ma)}/merchandising`,
        { method: "PATCH", body: JSON.stringify(payload) }
      );
    },
    onSuccess: (r) => {
      const patch: Partial<AdminProductKmRow> = {
        webKm: r.webKm,
        dangKm: Boolean(r.dangKm),
        giaGoc: r.dangKm ? r.giaGoc : undefined,
        phanTramGiam: r.dangKm ? r.phanTramGiam : undefined,
      };
      // Không ghi đè giá bằng 0/undefined (tránh UI về 0đ khi response thiếu field).
      if (Number(r.gia) > 0) patch.gia = Number(r.gia);
      if (Number(r.giaWeb) > 0) patch.giaWeb = Number(r.giaWeb);
      if (Number(r.giaThamChieu) > 0) patch.giaThamChieu = Number(r.giaThamChieu);
      if (typeof r.giaWebTangAo === "boolean") patch.giaWebTangAo = r.giaWebTangAo;
      onSaved(patch);
      toast.success("Đã lưu khuyến mãi");
      void qc.invalidateQueries({ queryKey: ["shop-admin-price-history", row.ma] });
    },
    onError: (e: Error) => toast.error(e.message || "Lưu thất bại"),
  });

  const clearMut = useMutation({
    mutationFn: () =>
      websiteApi<AdminProductKmRow & { ok: boolean }>(
        `/api/shop/admin/products/${encodeURIComponent(row.ma)}/merchandising`,
        { method: "PATCH", body: JSON.stringify({ webKm: null }) }
      ),
    onSuccess: (r) => {
      const patch: Partial<AdminProductKmRow> = {
        webKm: null,
        dangKm: false,
        giaGoc: undefined,
        phanTramGiam: undefined,
      };
      if (Number(r.gia) > 0) patch.gia = Number(r.gia);
      if (Number(r.giaWeb) > 0) patch.giaWeb = Number(r.giaWeb);
      if (Number(r.giaThamChieu) > 0) patch.giaThamChieu = Number(r.giaThamChieu);
      if (typeof r.giaWebTangAo === "boolean") patch.giaWebTangAo = r.giaWebTangAo;
      onSaved(patch);
      toast.success("Đã tắt giảm giá");
      void qc.invalidateQueries({ queryKey: ["shop-admin-price-history", row.ma] });
    },
    onError: (e: Error) => toast.error(e.message || "Tắt KM thất bại"),
  });

  const onGiaChange = (raw: string) => {
    const gia = Math.round(Number(raw) || 0);
    form.setValue("gia", gia, { shouldValidate: true });
    if (giaThamChieu > 0 && gia > 0 && gia < giaThamChieu) {
      form.setValue("phanTram", computePhanTramGiam(giaThamChieu, gia), {
        shouldValidate: true,
      });
    }
  };

  const onPctChange = (raw: string) => {
    const pct = Math.round(Number(raw) || 0);
    form.setValue("phanTram", pct, { shouldValidate: true });
    if (giaThamChieu > 0 && pct >= 1 && pct <= 99) {
      form.setValue("gia", priceFromPercent(giaThamChieu, pct), {
        shouldValidate: true,
      });
    }
  };

  const toneClass =
    chip.tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : chip.tone === "amber"
        ? "bg-amber-50 text-amber-800"
        : chip.tone === "slate"
          ? "bg-slate-100 text-slate-600"
          : "bg-gray-100 text-gray-500";

  return (
    <div className="border-t border-amber-100 bg-[#FFFBF5] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-gray-900">Khuyến mãi</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
              {chip.label}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-gray-500">
            Chưa giảm giá — nhập giá hoặc % bên dưới. Khách thấy giá đỏ + gốc gạch khi đang giảm.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white hover:text-gray-700"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <form
          className="space-y-3"
          noValidate
          onSubmit={form.handleSubmit((v) => {
            if (!(giaThamChieu > 0) || !(giaWeb > 0)) {
              toast.error(
                "Sản phẩm chưa có giá web hợp lệ — bấm Làm mới danh sách rồi thử lại"
              );
              return;
            }
            if (!previewOk) {
              toast.error(
                `Giá KM phải thấp hơn ${fmtVnd(giaThamChieu)} (giá thấp nhất 30 ngày)`
              );
              form.setFocus("gia");
              return;
            }
            saveMut.mutate(v);
          })}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[12px] text-gray-600">
              Giá web (niêm yết)
              <input
                readOnly
                value={fmtVnd(giaWeb)}
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-[13px] tabular-nums text-gray-700"
              />
            </label>
            <label className="block text-[12px] text-gray-600">
              Giá gạch (tham chiếu 30 ngày)
              <span
                className="ml-1 cursor-help text-gray-400"
                title="Mức thấp nhất khách từng thấy trên web trong 30 ngày. % giảm so với mức này — không so với giá vừa đẩy lên."
              >
                ?
              </span>
              <input
                readOnly
                value={fmtVnd(giaThamChieu)}
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-[13px] tabular-nums text-gray-700"
              />
            </label>
          </div>

          {row.giaWebTangAo || giaWeb > giaThamChieu ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Giá web đang cao hơn tham chiếu 30 ngày ({fmtVnd(giaThamChieu)}). Đặt giá KM
              dưới {fmtVnd(giaThamChieu)} — không được gạch theo giá vừa đẩy lên.
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[12px] font-medium text-gray-700">
              Giá khách trả (₫)
              <input
                type="number"
                min={1}
                step={1}
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-[13px] tabular-nums outline-none focus:border-[#3D6B3A]"
                {...form.register("gia", {
                  onChange: (e) => onGiaChange(e.target.value),
                })}
              />
              {form.formState.errors.gia ? (
                <span className="mt-0.5 block text-[11px] text-red-600">
                  {form.formState.errors.gia.message}
                </span>
              ) : null}
            </label>
            <label className="block text-[12px] font-medium text-gray-700">
              Giảm (%)
              <input
                type="number"
                min={1}
                max={99}
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-[13px] tabular-nums outline-none focus:border-[#3D6B3A]"
                {...form.register("phanTram", {
                  onChange: (e) => onPctChange(e.target.value),
                })}
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[12px] text-gray-600">
              Bắt đầu
              <input
                type="datetime-local"
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] outline-none focus:border-[#3D6B3A]"
                {...form.register("tu")}
              />
            </label>
            <label className="block text-[12px] text-gray-600">
              Kết thúc
              <input
                type="datetime-local"
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] outline-none focus:border-[#3D6B3A]"
                {...form.register("den")}
              />
              {form.formState.errors.den ? (
                <span className="mt-0.5 block text-[11px] text-red-600">
                  {form.formState.errors.den.message}
                </span>
              ) : null}
            </label>
          </div>

          {!previewOk && watchGia > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              Giá KM phải thấp hơn {fmtVnd(giaThamChieu)} (giá thấp nhất 30 ngày)
            </div>
          ) : null}
          {softWarnLow ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Giảm dưới 5% — vẫn lưu được, khách có thể khó nhận ra deal.
            </div>
          ) : null}
          {softWarnHigh ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Giảm trên 50% — kiểm tra hạn mức khuyến mại VN trước khi chạy campaign lớn.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saveMut.isPending || !previewOk}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3D6B3A] px-3.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Lưu khuyến mãi
            </button>
            <button
              type="button"
              disabled={clearMut.isPending || !row.webKm}
              onClick={() => clearMut.mutate()}
              className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-semibold text-gray-700 disabled:opacity-40"
            >
              Tắt giảm giá
            </button>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-[#3D6B3A] hover:bg-white"
            >
              <History className="h-3.5 w-3.5" />
              Lịch sử giá
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Khách sẽ thấy
          </p>
          <div className="mt-2 flex gap-2">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {row.anh ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.anh} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[12px] font-medium text-gray-800">{row.ten}</p>
              <div className="mt-1">
                {previewOk && !previewScheduleNote ? (
                  <ProductPrice
                    gia={watchGia}
                    giaGoc={giaThamChieu}
                    dangKm
                    phanTramGiam={previewPct}
                    layout="stack"
                    priceClassName="text-base"
                  />
                ) : (
                  <ProductPrice gia={giaWeb} layout="stack" priceClassName="text-base" />
                )}
              </div>
              {previewScheduleNote ? (
                <p className="mt-1 text-[11px] text-amber-700">{previewScheduleNote}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showHistory ? (
        <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white">
          {historyQ.isLoading ? (
            <p className="px-3 py-4 text-[12px] text-gray-400">Đang tải lịch sử…</p>
          ) : historyQ.isError ? (
            <p className="px-3 py-4 text-[12px] text-red-600">Không tải được lịch sử giá</p>
          ) : !(historyQ.data?.rows || historyQ.data?.points || []).length ? (
            <p className="px-3 py-4 text-[12px] text-gray-400">Chưa có mốc giá ghi nhận</p>
          ) : (
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Thời điểm</th>
                  <th className="px-3 py-2 text-right">Giá web</th>
                  <th className="px-3 py-2 text-right">Giá KM</th>
                  <th className="px-3 py-2 text-right">% giảm</th>
                  <th className="px-3 py-2">Ai</th>
                </tr>
              </thead>
              <tbody>
                {(historyQ.data?.rows || historyQ.data?.points || []).map(
                  (p, i) => {
                    const giaWeb = Number(p.giaWeb) > 0 ? Number(p.giaWeb) : Number(p.gia);
                    const giaKm =
                      p.giaKm != null && Number(p.giaKm) > 0
                        ? Number(p.giaKm)
                        : null;
                    const pct =
                      p.phanTram != null && Number(p.phanTram) > 0
                        ? Math.round(Number(p.phanTram))
                        : giaKm && giaWeb > giaKm
                          ? Math.max(
                              1,
                              Math.min(
                                99,
                                Math.round((1 - giaKm / giaWeb) * 100)
                              )
                            )
                          : null;
                    const bump =
                      giaWeb > 0 &&
                      i > 0 &&
                      Number(
                        (historyQ.data?.rows || historyQ.data?.points || [])[
                          i - 1
                        ]?.giaWeb ||
                          (historyQ.data?.rows || historyQ.data?.points || [])[
                            i - 1
                          ]?.gia
                      ) > 0 &&
                      giaWeb >
                        Number(
                          (historyQ.data?.rows ||
                            historyQ.data?.points ||
                            [])[i - 1]?.giaWeb ||
                            (historyQ.data?.rows ||
                              historyQ.data?.points ||
                              [])[i - 1]?.gia
                        );
                    return (
                      <tr
                        key={`${p.at}-${i}`}
                        className={`border-t border-gray-50 ${bump ? "bg-amber-50/80" : ""}`}
                      >
                        <td className="px-3 py-1.5 text-gray-600">
                          {new Date(p.at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {fmtVnd(giaWeb)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-red-700">
                          {giaKm ? fmtVnd(giaKm) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-red-700">
                          {pct ? `-${pct}%` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-400">{p.by || "—"}</td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
