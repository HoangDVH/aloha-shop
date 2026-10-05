"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ApplicationSource, ApplyJobTarget, RecruitmentFormOptions } from "@/lib/recruitment";
import { ApplyDialog } from "./ApplyDialog";
import { RecruitmentApplyForm } from "./RecruitmentApplyForm";

/** ?ung-tuyen=chung → form liên hệ chung; ?ung-tuyen=<jobId> → form của tin đó (dùng khi quay về sau đăng nhập). */
export const APPLY_PARAM = "ung-tuyen";
const SOURCE_PARAM = "nguon";
const GENERAL = "chung";
const SOURCES: ApplicationSource[] = ["hero", "job_card", "job_detail", "connect_section"];

type Target = { job?: ApplyJobTarget; source: ApplicationSource };
type HubValue = { enabled: boolean; openApply: (t: Target) => void };

const HubContext = createContext<HubValue | null>(null);

function returnPathFor(target: Target): string {
  const url = new URL(window.location.href);
  url.searchParams.set(APPLY_PARAM, target.job ? target.job.id : GENERAL);
  url.searchParams.set(SOURCE_PARAM, target.source);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

export function RecruitmentApplyProvider({
  options,
  jobs = [],
  children,
}: {
  options: RecruitmentFormOptions | null;
  jobs?: ApplyJobTarget[];
  children: React.ReactNode;
}) {
  const enabled = Boolean(options?.applyEnabled);
  // Form giữ nguyên dữ liệu khi mở lại cùng một tin; đổi tin thì form mới.
  const [job, setJob] = useState<ApplyJobTarget | undefined>();
  const [source, setSource] = useState<ApplicationSource | null>(null);
  const [open, setOpen] = useState(false);
  const [loginReturnPath, setLoginReturnPath] = useState<string>();

  const openApply = useCallback(
    (t: Target) => {
      if (!enabled) return;
      setJob(t.job);
      setSource(t.source);
      setLoginReturnPath(returnPathFor(t));
      setOpen(true);
    },
    [enabled]
  );
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    const want = url.searchParams.get(APPLY_PARAM);
    if (!want) return;
    const rawSource = url.searchParams.get(SOURCE_PARAM) as ApplicationSource | null;
    url.searchParams.delete(APPLY_PARAM);
    url.searchParams.delete(SOURCE_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    const fromLink = rawSource && SOURCES.includes(rawSource) ? rawSource : null;
    if (want === GENERAL) openApply({ source: fromLink || "hero" });
    else {
      const found = jobs.find((j) => j.id === want);
      if (found) openApply({ job: found, source: fromLink || "job_card" });
    }
    // Chỉ đọc tham số một lần khi vào trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const suggestions = useMemo(() => [...new Set(jobs.map((j) => j.title))].slice(0, 30), [jobs]);
  const value = useMemo(() => ({ enabled, openApply }), [enabled, openApply]);

  return (
    <HubContext.Provider value={value}>
      {children}
      {enabled && options && source ? (
        <ApplyDialog
          open={open}
          onClose={close}
          title={job ? `Ứng tuyển: ${job.title}` : "Ứng tuyển ngay"}
          subtitle={job ? undefined : "Để lại thông tin, Aloha sẽ liên hệ khi có công việc phù hợp."}
        >
          <RecruitmentApplyForm
            key={job?.id || GENERAL}
            options={options}
            job={job}
            source={source}
            positionSuggestions={suggestions}
            loginReturnPath={loginReturnPath}
            idPrefix={job ? `apply-${job.id}` : "apply-general"}
          />
        </ApplyDialog>
      ) : null}
    </HubContext.Provider>
  );
}

export function useApplyHub(): HubValue | null {
  return useContext(HubContext);
}

/** Nút mở popup; tự ẩn khi Aloha chưa mở nhận hồ sơ. */
export function ApplyButton({
  source,
  job,
  className,
  children,
}: {
  source: ApplicationSource;
  job?: ApplyJobTarget;
  className: string;
  children: React.ReactNode;
}) {
  const hub = useApplyHub();
  if (!hub?.enabled) return null;
  return (
    <button type="button" onClick={() => hub.openApply({ source, job })} className={className}>
      {children}
    </button>
  );
}
