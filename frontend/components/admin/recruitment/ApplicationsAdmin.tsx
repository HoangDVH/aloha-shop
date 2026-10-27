"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Paperclip, RefreshCw, Search, UserRound, X } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "@/components/admin/website/api";
import { WbBadge, WbBtn } from "@/components/admin/website/ui";
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

const filterSelect =
  "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs sm:text-sm text-gray-700 outline-none transition hover:border-gray-300 focus:border-[#0F9D58]/50 focus:ring-2 focus:ring-[#0F9D58]/15";

export function ApplicationsAdmin() {
  const sp = useSearchParams();
  const paramId = sp?.get("id") || "";
  const paramCode = sp?.get("code") || sp?.get("q") || "";

  const [jobId, setJobId] = useState(sp?.get("jobId") || "");
  const [status, setStatus] = useState<"" | ApplicationStatus>("");
  const [submissionType, setSubmissionType] = useState("");
  const [source, setSource] = useState("");
  const [hasCv, setHasCv] = useState("");
  const [q, setQ] = useState(paramCode);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [openId, setOpenId] = useState<string | null>(paramId || null);
  const lastTargetRef = useRef<string>((paramId || paramCode).trim().toUpperCase());
  const dismissedRef = useRef<boolean>(false);

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

  // Đồng bộ target khi URL searchParams thay đổi (ví dụ click từ thông báo khác)
  useEffect(() => {
    const currentTarget = (paramId || paramCode).trim().toUpperCase();
    if (currentTarget && currentTarget !== lastTargetRef.current) {
      lastTargetRef.current = currentTarget;
      dismissedRef.current = false;
    }
  }, [paramId, paramCode]);

  // Lắng nghe sự kiện click trực tiếp từ trung tâm thông báo (nhanh tức thì, không phụ thuộc reload)
  useEffect(() => {
    const handleNotifTarget = (e: Event) => {
      const customEvent = e as CustomEvent;
      const item = customEvent.detail;
      if (!item || item.type !== "recruitment") return;
      try {
        const url = new URL(item.link, window.location.origin);
        const target = (
          url.searchParams.get("code") ||
          url.searchParams.get("id") ||
          url.searchParams.get("q") ||
          ""
        ).trim();
        if (target) {
          lastTargetRef.current = target.toUpperCase();
          dismissedRef.current = false;
          setQ(target);
          setPage(1);

          const matched = rows.find(
            (r) =>
              r.id === target ||
              r.publicCode?.toUpperCase() === target.toUpperCase() ||
              r.contact?.phone === target
          );
          if (matched) {
            setOpenId(matched.id);
          }
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("aloha_open_notification_target", handleNotifTarget);
    return () => window.removeEventListener("aloha_open_notification_target", handleNotifTarget);
  }, [rows]);

  // Tự động mở hồ sơ ứng viên khi điều hướng từ thông báo / URL (chỉ mở 1 lần, không loop khi đóng)
  useEffect(() => {
    if (dismissedRef.current || !rows.length) return;
    const target = (paramId || paramCode).trim();
    if (!target) return;
    const matched = rows.find(
      (r) =>
        r.id === target ||
        r.publicCode?.toUpperCase() === target.toUpperCase() ||
        r.contact?.phone === target
    );
    if (matched) {
      setOpenId(matched.id);
    }
  }, [rows, paramId, paramCode]);

  const handleCloseDrawer = useCallback(() => {
    setOpenId(null);
    dismissedRef.current = true;
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("code") || url.searchParams.has("id")) {
          url.searchParams.delete("code");
          url.searchParams.delete("id");
          const nextSearch = url.searchParams.toString();
          window.history.replaceState(
            {},
            "",
            url.pathname + (nextSearch ? `?${nextSearch}` : "")
          );
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const hasActiveFilters = Boolean(q || jobId || status || submissionType || source || hasCv);

  const resetAllFilters = () => {
    lastTargetRef.current = "";
    dismissedRef.current = true;
    setQ("");
    setJobId("");
    setStatus("");
    setSubmissionType("");
    setSource("");
    setHasCv("");
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

      {/* Trạng thái quy trình ứng viên (chuẩn ATS / Tuyển dụng) */}
      <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => resetPage(setStatus)("")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            status === ""
              ? "bg-[#0F9D58] text-white shadow-xs"
              : "border border-gray-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          Tất cả trạng thái
        </button>
        {Object.entries(APPLICATION_STATUS_LABELS).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => resetPage(setStatus)(v as ApplicationStatus)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === v
                ? "bg-[#0F9D58] text-white shadow-xs"
                : "border border-gray-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Thanh công cụ tìm kiếm & bộ lọc ngang tinh gọn */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-2xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            className="h-9 w-full rounded-lg border border-gray-200 bg-slate-50/50 pl-8 pr-7 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#0F9D58]/50 focus:bg-white focus:ring-2 focus:ring-[#0F9D58]/15"
            placeholder="Tìm theo mã, email, SĐT, tên…"
            value={q}
            onChange={(e) => resetPage(setQ)(e.target.value)}
          />
          {q ? (
            <button
              type="button"
              onClick={() => resetPage(setQ)("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <select
          className={`${filterSelect} w-full sm:w-[190px]`}
          value={jobId}
          onChange={(e) => resetPage(setJobId)(e.target.value)}
        >
          <option value="">Tất cả vị trí</option>
          <option value="none">Liên hệ chung (không gắn tin)</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>

        <select
          className={`${filterSelect} w-full sm:w-[145px]`}
          value={submissionType}
          onChange={(e) => resetPage(setSubmissionType)(e.target.value)}
        >
          <option value="">Mọi loại hồ sơ</option>
          <option value="job_application">Ứng tuyển tin</option>
          <option value="general_interest">Liên hệ tuyển dụng</option>
        </select>

        <select
          className={`${filterSelect} w-full sm:w-[150px]`}
          value={source}
          onChange={(e) => resetPage(setSource)(e.target.value)}
        >
          <option value="">Mọi nguồn nộp</option>
          {Object.entries(APPLICATION_SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          <option value="unknown">Không rõ nguồn</option>
        </select>

        <select
          className={`${filterSelect} w-full sm:w-[110px]`}
          value={hasCv}
          onChange={(e) => resetPage(setHasCv)(e.target.value)}
        >
          <option value="">CV: tất cả</option>
          <option value="1">Có CV</option>
          <option value="0">Không CV</option>
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            title="Đặt lại tất cả bộ lọc"
          >
            <X size={13} />
            <span>Xóa lọc</span>
          </button>
        ) : null}
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

      <ApplicationDrawer id={openId} jobs={jobs} onClose={handleCloseDrawer} onChanged={() => void load()} />
    </div>
  );
}
