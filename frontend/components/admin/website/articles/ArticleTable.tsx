"use client";

import React from "react";
import { Eye, EyeOff, FileText, Pencil, Trash2 } from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/ui/AdminSkeleton";
import type { Article } from "./articleUtils";

export function ArticleTable({
  loading,
  rows,
  busyId,
  openPreview,
  openEdit,
  toggleVisible,
  remove,
}: {
  loading: boolean;
  rows: Article[];
  busyId: string | null;
  openPreview: (row: Article) => void;
  openEdit: (row: Article) => void;
  toggleVisible: (row: Article) => void;
  remove: (row: Article) => void;
}) {
  if (loading && !rows.length) {
    return (
      <AdminTableSkeleton
        rows={8}
        cols={5}
        headers={["Bài viết", "Danh mục", "Ngày XB", "TT", "Thao tác"]}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-[#0F9D58] text-[11px] uppercase tracking-wide text-white">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Bài viết</th>
            <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Danh mục</th>
            <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Ngày XB</th>
            <th className="px-3 py-2.5 font-semibold">TT</th>
            <th className="px-3 py-2.5 text-right font-semibold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100 hover:bg-[#E8F5E9]/60">
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => void openPreview(row)}
                  className="flex w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left"
                  style={{ border: "none", background: "transparent" }}
                  title="Xem bài viết"
                >
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {row.coverUrl ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <img src={row.coverUrl} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1e3a5f] hover:underline">
                      {row.title}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">/{row.slug}</p>
                  </div>
                </button>
              </td>
              <td className="hidden px-3 py-2.5 text-gray-600 sm:table-cell">
                {row.category || "—"}
              </td>
              <td className="hidden px-3 py-2.5 text-gray-600 md:table-cell">
                {row.publishedAt
                  ? new Date(row.publishedAt).toLocaleString("vi-VN")
                  : "—"}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    row.visible
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {row.visible ? "Hiện" : "Ẩn"}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    title={row.visible ? "Ẩn" : "Hiện"}
                    disabled={busyId === row.id}
                    onClick={() => void toggleVisible(row)}
                  >
                    {row.visible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    title="Sửa"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    title="Xóa"
                    disabled={busyId === row.id}
                    onClick={() => void remove(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-400">
                Chưa có bài viết. Bấm «Thêm bài» để tạo.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
