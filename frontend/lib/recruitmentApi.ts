import { shopApiBase } from "@/lib/api";
import type { PublicJobDetail, PublicJobListItem, RecruitmentFormOptions } from "@/lib/recruitment";

async function getJson<T>(path: string, revalidate = 30): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${shopApiBase()}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as T };
}

export async function fetchRecruitmentJobs(opts: { page?: number; q?: string }) {
  const sp = new URLSearchParams();
  if (opts.page && opts.page > 1) sp.set("page", String(opts.page));
  if (opts.q) sp.set("q", opts.q);
  const qs = sp.toString();
  const r = await getJson<{ items: PublicJobListItem[]; total: number; page: number; pages: number }>(
    `/api/shop/recruitment/jobs${qs ? `?${qs}` : ""}`
  );
  if (!r.data) throw new Error(`HTTP ${r.status}`);
  return r.data;
}

/** null khi tin không tồn tại hoặc còn nháp. */
export async function fetchRecruitmentJob(slug: string): Promise<PublicJobDetail | null> {
  const r = await getJson<{ item: PublicJobDetail }>(
    `/api/shop/recruitment/jobs/${encodeURIComponent(slug)}`
  );
  if (r.status === 404) return null;
  if (!r.data) throw new Error(`HTTP ${r.status}`);
  return r.data.item;
}

export async function fetchRecruitmentFormOptions(): Promise<RecruitmentFormOptions | null> {
  try {
    const r = await getJson<RecruitmentFormOptions>("/api/shop/recruitment/form-options");
    return r.data;
  } catch {
    return null;
  }
}
