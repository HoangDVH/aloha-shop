"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "@/components/admin/website/api";
import { WbBadge, WbBtn, wbInput, wbSelect } from "@/components/admin/website/ui";
import { AdminPageHeader } from "@/components/admin/shell/AdminUi";
import {
  EMPLOYMENT_TYPE_LABELS,
  formatLocation,
  formatSalary,
  formatVnDate,
  type JobLocation,
} from "@/lib/recruitment";
import { JobEditor } from "./JobEditor";
import {
  JOB_STATUS_LABELS,
  emptyJobForm,
  formToPayload,
  jobToForm,
  type AdminJob,
  type JobFormState,
  type JobStatus,
} from "./recruitmentAdminTypes";

const STATUS_TONE: Record<JobStatus, "neutral" | "success" | "warn"> = {
  draft: "neutral",
  open: "success",
  closed: "warn",
};

export function JobsAdmin() {
  const [rows, setRows] = useState<AdminJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | JobStatus>("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<JobFormState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<{ field?: string; message: string } | null>(null);
  const [suggested, setSuggested] = useState<JobLocation[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const r = await websiteApi<{ items: AdminJob[]; total: number }>(`/api/shop/admin/recruitment/jobs?${params}`);
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      toast.error(e?.message || "Không tải được tin tuyển dụng");
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    websiteApi<{ locations: JobLocation[] }>("/api/shop/recruitment/form-options")
      .then((r) => setSuggested(r.locations || []))
      .catch(() => setSuggested([]));
  }, []);

  const openEditor = (form: JobFormState) => {
    setEditing(form);
    setDirty(false);
    setEditorError(null);
  };

  const closeEditor = () => {
    if (dirty && !window.confirm("Bạn chưa lưu. Đóng và mất thay đổi?")) return;
    setEditing(null);
    setDirty(false);
  };

  const patchJob = (id: string, body: Record<string, unknown>) =>
    websiteApi<{ item: AdminJob }>(`/api/shop/admin/recruitment/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

  const save = async (action: "save" | "open" | "close") => {
    if (!editing) return;
    if (!editing.title.trim()) {
      setEditorError({ field: "title", message: "Nhập tên vị trí" });
      return;
    }
    setSaving(true);
    setEditorError(null);
    try {
      const fields = formToPayload(editing);
      let item: AdminJob;
      if (!editing.id) {
        item = (await websiteApi<{ item: AdminJob }>("/api/shop/admin/recruitment/jobs", {
          method: "POST",
          body: JSON.stringify({ fields }),
        })).item;
        setEditing(jobToForm(item));
        setDirty(false);
        void load();
        if (action === "open") item = (await patchJob(item.id, { expectedVersion: item.version, status: "open" })).item;
      } else {
        const body: Record<string, unknown> = { expectedVersion: editing.version, fields };
        if (action === "open") body.status = "open";
        if (action === "close") body.status = "closed";
        item = (await patchJob(editing.id, body)).item;
      }
      setEditing(jobToForm(item));
      setDirty(false);
      toast.success(action === "open" ? "Đã mở tin" : action === "close" ? "Đã đóng tin" : "Đã lưu");
      void load();
    } catch (e: any) {
      setEditorError({ message: e?.message || "Lưu thất bại" });
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (row: AdminJob, next: "open" | "closed") => {
    if (next === "closed" && !window.confirm(`Đóng tin «${row.title}»? Hồ sơ cũ vẫn được xử lý.`)) return;
    setBusyId(row.id);
    try {
      await patchJob(row.id, { expectedVersion: row.version, status: next });
      toast.success(next === "open" ? "Đã mở tin" : "Đã đóng tin");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Không đổi được trạng thái");
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (row: AdminJob) => {
    setBusyId(row.id);
    try {
      const r = await websiteApi<{ item: AdminJob }>(`/api/shop/admin/recruitment/jobs/${row.id}/duplicate`, { method: "POST" });
      toast.success("Đã tạo bản nháp mới — chọn hạn nộp rồi mở tin");
      openEditor(jobToForm(r.item));
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Không nhân bản được");
    } finally {
      setBusyId(null);
    }
  };

  if (editing) {
    return (
      <JobEditor
        form={editing}
        onChange={(f) => {
          setEditing(f);
          setDirty(true);
        }}
        onClose={closeEditor}
        onSave={save}
        saving={saving}
        dirty={dirty}
        suggestedLocations={suggested}
        error={editorError}
      />
    );
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div>
      <AdminPageHeader
        title="Tin tuyển dụng"
        description="Soạn nháp, xem trước, mở/đóng tin. Thay đổi lớn sau khi đã đăng: đóng tin rồi «Nhân bản» thành đợt mới."
        actions={
          <>
            <WbBtn variant="ghost" onClick={() => void load()} title="Tải lại">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </WbBtn>
            <WbBtn variant="primary" onClick={() => openEditor(emptyJobForm())}>
              <Plus className="h-4 w-4" /> Tạo tin
            </WbBtn>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input className={`${wbInput} pl-8`} placeholder="Tìm tên vị trí…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select className={`${wbSelect} w-[160px]`} value={status} onChange={(e) => { setStatus(e.target.value as "" | JobStatus); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(JOB_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="bg-[#0F9D58] text-[11px] uppercase tracking-wide text-white">
            <tr>
              <th className="px-3 py-2.5">Vị trí</th>
              <th className="px-3 py-2.5">Nơi làm</th>
              <th className="px-3 py-2.5">Loại hình</th>
              <th className="px-3 py-2.5">Lương</th>
              <th className="px-3 py-2.5">Hạn</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Hồ sơ</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 align-top hover:bg-[#E8F5E9]/60">
                <td className="px-3 py-2.5">
                  <button type="button" className="text-left font-semibold text-[#1e3a5f] hover:underline" onClick={() => openEditor(jobToForm(r))}>
                    {r.title}
                  </button>
                  <p className="text-[11px] text-gray-400">/{r.slug}</p>
                </td>
                <td className="px-3 py-2.5 text-gray-600">{r.locations.map(formatLocation).join("; ") || "—"}</td>
                <td className="px-3 py-2.5 text-gray-600">{EMPLOYMENT_TYPE_LABELS[r.employmentType]}</td>
                <td className="px-3 py-2.5 text-gray-600">{formatSalary(r.salary)}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.deadlineAt ? formatVnDate(r.deadlineAt) : "—"}</td>
                <td className="px-3 py-2.5">
                  <WbBadge tone={STATUS_TONE[r.status]}>{JOB_STATUS_LABELS[r.status]}</WbBadge>
                  {r.status === "open" && !r.acceptingApplications ? <p className="mt-1 text-[11px] text-amber-700">Quá hạn</p> : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link href={`/admin/tuyen-dung/ho-so?jobId=${r.id}`} className="font-semibold text-[#0C8048] hover:underline">
                    {r.applicationCount}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <WbBtn variant="ghost" title="Sửa" onClick={() => openEditor(jobToForm(r))}><Pencil className="h-4 w-4" /></WbBtn>
                    <WbBtn variant="ghost" title="Nhân bản thành đợt mới" disabled={busyId === r.id} onClick={() => void duplicate(r)}><Copy className="h-4 w-4" /></WbBtn>
                    {r.publishedAt ? (
                      <WbBtn variant="ghost" title="Xem trên web" href={`/tuyen-dung/${r.slug}`}><ExternalLink className="h-4 w-4" /></WbBtn>
                    ) : null}
                    {r.status === "open" ? (
                      <WbBtn variant="danger" disabled={busyId === r.id} onClick={() => void quickStatus(r, "closed")}>Đóng</WbBtn>
                    ) : (
                      <WbBtn variant="secondary" disabled={busyId === r.id} onClick={() => void quickStatus(r, "open")}>Mở</WbBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-400">Chưa có tin. Bấm «Tạo tin».</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-[12px] text-gray-500">
          <span>{total} tin · trang {page}/{pages}</span>
          <div className="flex gap-1">
            <WbBtn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</WbBtn>
            <WbBtn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sau</WbBtn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
