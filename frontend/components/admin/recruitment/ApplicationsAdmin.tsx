"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Paperclip, RefreshCw, Search, UserRound } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "@/components/admin/website/api";
import { WbBadge, WbBtn, wbInput, wbSelect } from "@/components/admin/website/ui";
import { AdminPageHeader } from "@/components/admin/shell/AdminUi";
import {
  APPLICATION_SOURCE_LABELS,
  APPLICATION_STATUS_LABELS,
  CV_FORMAT_LABELS,
  formatVnDateTime,
  type ApplicationStatus,
} from "@/lib/recruitment";
import { ApplicationDrawer } from "./ApplicationDrawer";
import type { AdminApplicationListItem, AdminJob } from "./recruitmentAdminTypes";

const LIMIT = 30;

export function ApplicationsAdmin() {
  const sp = useSearchParams();
  const [jobId, setJobId] = useState(sp?.get("jobId") || "");
  const [status, setStatus] = useState<"" | ApplicationStatus>("");
  const [submissionType, setSubmissionType] = useState("");
  const [source, setSource] = useState("");
  const [hasCv, setHasCv] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (jobId) params.set("jobId", jobId);
      if (status) params.set("status", status);
      if (submissionType) params.set("submissionType", submissionType);
      if (source) params.set("source", source);
      if (hasCv) params.set("hasCv", hasCv);
      if (q.trim()) params.set("q", q.trim());
      const r = await websiteApi<{ items: AdminApplicationListItem[]; total: number }>(
        `/api/shop/admin/recruitment/applications?${params}`
      );
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      toast.error(e?.message || "Không tải được hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [page, jobId, status, submissionType, source, hasCv, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    websiteApi<{ items: AdminJob[] }>("/api/shop/admin/recruitment/jobs?limit=100")
      .then((r) => setJobs(r.items || []))
      .catch(() => setJobs([]));
  }, []);

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <div>
      <AdminPageHeader
        title="Hồ sơ ứng viên"
        description="Hồ sơ ứng tuyển tin và liên hệ tuyển dụng chung. Tìm theo mã TD-…, email, SĐT hoặc tên."
        actions={
          <WbBtn variant="ghost" onClick={() => void load()} title="Tải lại">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </WbBtn>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input className={`${wbInput} pl-8`} placeholder="Mã, email, SĐT, tên…" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
        </div>
        <select className={`${wbSelect} w-[220px]`} value={jobId} onChange={(e) => resetPage(setJobId)(e.target.value)}>
          <option value="">Tất cả vị trí</option>
          <option value="none">Liên hệ chung (không gắn tin)</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <select className={`${wbSelect} w-[160px]`} value={status} onChange={(e) => resetPage(setStatus)(e.target.value as "" | ApplicationStatus)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className={`${wbSelect} w-[170px]`} value={submissionType} onChange={(e) => resetPage(setSubmissionType)(e.target.value)}>
          <option value="">Mọi loại hồ sơ</option>
          <option value="job_application">Ứng tuyển tin</option>
          <option value="general_interest">Liên hệ tuyển dụng</option>
        </select>
        <select className={`${wbSelect} w-[180px]`} value={source} onChange={(e) => resetPage(setSource)(e.target.value)}>
          <option value="">Mọi nguồn nộp</option>
          {Object.entries(APPLICATION_SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
          <option value="unknown">Không rõ nguồn</option>
        </select>
        <select className={`${wbSelect} w-[130px]`} value={hasCv} onChange={(e) => resetPage(setHasCv)(e.target.value)}>
          <option value="">CV: tất cả</option>
          <option value="1">Có CV</option>
          <option value="0">Không CV</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead className="bg-[#0F9D58] text-[11px] uppercase tracking-wide text-white">
            <tr>
              <th className="px-3 py-2.5">Ứng viên</th>
              <th className="px-3 py-2.5">Vị trí</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Ngày nộp</th>
              <th className="px-3 py-2.5">Mã</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer border-t border-gray-100 hover:bg-[#E8F5E9]/60" onClick={() => setOpenId(r.id)}>
                <td className="px-3 py-2.5">
                  <p className="flex items-center gap-1 font-semibold text-[#1e3a5f]">
                    {r.contact.fullName}
                    {r.hasAccount ? (
                      <UserRound className="h-3.5 w-3.5 text-[#0F9D58]" aria-label="Có tài khoản shop" />
                    ) : null}
                  </p>
                  <p className="text-[11px] text-gray-500">{r.contact.email} · {r.contact.phone}</p>
                  {r.source ? <p className="text-[11px] text-gray-400">{APPLICATION_SOURCE_LABELS[r.source]}</p> : null}
                </td>
                <td className="px-3 py-2.5 text-gray-700">
                  {r.jobTitle || (
                    <span>
                      <span className="text-[11px] font-semibold text-sky-700">Liên hệ tuyển dụng · </span>
                      {r.interestedPosition}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <WbBadge tone={r.status === "new" ? "info" : r.status === "hired" ? "success" : "neutral"}>
                      {APPLICATION_STATUS_LABELS[r.status]}
                    </WbBadge>
                    {r.possibleDuplicate ? <WbBadge tone="warn">Nghi trùng</WbBadge> : null}
                    {r.hasCv ? (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500" title="Có CV">
                        <Paperclip className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                        {r.cvFormat ? CV_FORMAT_LABELS[r.cvFormat] : "CV"}
                      </span>
                    ) : null}
                    {r.appointmentAt ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                        <CalendarClock className="h-3.5 w-3.5" /> {formatVnDateTime(r.appointmentAt)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-600">{formatVnDateTime(r.createdAt)}</td>
                <td className="px-3 py-2.5 font-mono text-[12px] text-gray-500">{r.publicCode}</td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-400">Chưa có hồ sơ khớp bộ lọc.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-[12px] text-gray-500">
          <span>{total} hồ sơ · trang {page}/{pages}</span>
          <div className="flex gap-1">
            <WbBtn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</WbBtn>
            <WbBtn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sau</WbBtn>
          </div>
        </div>
      ) : null}

      <ApplicationDrawer id={openId} jobs={jobs} onClose={() => setOpenId(null)} onChanged={() => void load()} />
    </div>
  );
}
