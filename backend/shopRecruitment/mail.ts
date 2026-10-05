import type { RecruitmentApplicationDoc } from "./types.js";

const BRAND = "ALOHA Thế giới chậu cây";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mailFrom(): string {
  return (
    String(process.env.RECRUITMENT_MAIL_FROM || "").trim() ||
    String(process.env.SHOP_MAIL_FROM || "").trim() ||
    `${BRAND} <donhang@donhang.alohathegioichaucay.com>`
  );
}

function shopUrl(): string {
  return String(process.env.SHOP_PUBLIC_URL || "https://alohathegioichaucay.com").replace(/\/$/, "");
}

export function confirmationEmail(doc: Pick<
  RecruitmentApplicationDoc,
  "submissionType" | "interestedPosition" | "publicCode" | "contact"
>) {
  const isJob = doc.submissionType === "job_application";
  const subject = isJob
    ? `Aloha đã nhận hồ sơ ứng tuyển — ${doc.interestedPosition}`
    : "Aloha đã nhận thông tin quan tâm tuyển dụng của bạn";
  const lead = isJob
    ? `Aloha đã nhận hồ sơ ứng tuyển vị trí <strong>${esc(doc.interestedPosition)}</strong>.`
    : `Aloha đã nhận thông tin quan tâm tuyển dụng (vị trí quan tâm: <strong>${esc(doc.interestedPosition)}</strong>).`;
  const next = isJob
    ? "Bộ phận tuyển dụng sẽ xem hồ sơ và liên hệ qua email hoặc điện thoại nếu hồ sơ phù hợp."
    : "Aloha sẽ liên hệ khi có công việc phù hợp với thông tin bạn để lại.";
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
<p>Chào ${esc(doc.contact.fullName)},</p>
<p>${lead}</p>
<p>Mã biên nhận: <strong>${esc(doc.publicCode)}</strong></p>
<p>${next}</p>
<p>Muốn rút hồ sơ hoặc yêu cầu xóa dữ liệu, vui lòng trả lời email này hoặc liên hệ Aloha qua kênh chính thức tại <a href="${shopUrl()}/tuyen-dung">${shopUrl()}/tuyen-dung</a>.</p>
<p>Trân trọng,<br>${BRAND}</p>
</body></html>`;
  return { subject, html };
}

export async function sendRecruitmentEmail(opts: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<{ ok: true } | { ok: false; code: string; retryable: boolean }> {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return { ok: false, code: "missing_resend_key", retryable: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": opts.idempotencyKey,
      },
      body: JSON.stringify({ from: mailFrom(), to: [opts.to], subject: opts.subject, html: opts.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false, code: `http_${res.status}`, retryable };
  } catch (e: any) {
    return { ok: false, code: e?.name === "TimeoutError" ? "timeout" : "network", retryable: true };
  }
}
