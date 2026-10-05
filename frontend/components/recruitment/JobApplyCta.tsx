"use client";

import type { ApplyJobTarget, RecruitmentFormOptions } from "@/lib/recruitment";
import { ApplyButton, RecruitmentApplyProvider } from "./ApplyHub";

export function ApplyUnavailable() {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
      Aloha chưa mở nhận hồ sơ trực tuyến. Vui lòng liên hệ qua số điện thoại / Zalo ở cuối trang.
    </p>
  );
}

export const applyPrimaryBtnCls =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--aloha-green-dark)] px-8 text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] sm:w-auto";

/** Nút ứng tuyển trên trang chi tiết tin. */
export function JobApplyCta({ options, job }: { options: RecruitmentFormOptions; job: ApplyJobTarget }) {
  return (
    <RecruitmentApplyProvider options={options} jobs={[job]}>
      <ApplyButton source="job_detail" job={job} className={applyPrimaryBtnCls}>
        Ứng tuyển ngay
      </ApplyButton>
    </RecruitmentApplyProvider>
  );
}
