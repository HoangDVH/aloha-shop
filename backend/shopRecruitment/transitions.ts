import type { ApplicationStatus } from "./types.js";

const PIPELINE: ApplicationStatus[] = ["new", "reviewing", "interviewing", "offered", "hired"];
const TERMINAL = new Set<ApplicationStatus>(["hired", "rejected", "withdrawn"]);

export type TransitionCheck =
  | { ok: true; needsReason: boolean; kind: "forward" | "end" | "backward" | "reopen" }
  | { ok: false; message: string };

/**
 * Tiến trình hồ sơ: đi tiếp tự do; kết thúc (rejected/withdrawn) từ bất kỳ bước chưa kết thúc;
 * hired chỉ sau offered (ứng viên thực tế đi làm). Chuyển lùi hoặc mở lại phải có lý do.
 */
export function checkStatusTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  reason?: string
): TransitionCheck {
  if (from === to) return { ok: false, message: "Hồ sơ đã ở trạng thái này" };
  const hasReason = Boolean(reason?.trim());

  if (to === "hired" && from !== "offered") {
    return { ok: false, message: "Chỉ chuyển «Đã nhận việc» sau bước «Đã đề nghị»" };
  }

  if (TERMINAL.has(from)) {
    if (!hasReason) return { ok: false, message: "Mở lại hồ sơ cần nhập lý do" };
    return { ok: true, needsReason: true, kind: "reopen" };
  }

  if (to === "rejected" || to === "withdrawn") {
    return { ok: true, needsReason: false, kind: "end" };
  }

  const fi = PIPELINE.indexOf(from);
  const ti = PIPELINE.indexOf(to);
  if (ti > fi) return { ok: true, needsReason: false, kind: "forward" };
  if (!hasReason) return { ok: false, message: "Chuyển lùi trạng thái cần nhập lý do" };
  return { ok: true, needsReason: true, kind: "backward" };
}
