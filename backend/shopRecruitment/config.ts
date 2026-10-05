import fs from "fs";
import path from "path";
import type { JobLocation } from "./types.js";
import { slugifyVi } from "../shopArticles/sanitize.js";

/**
 * Cấu hình tuyển dụng cố định bằng env (không có màn hình cấu hình động).
 * Form chỉ nhận hồ sơ khi Aloha đã chốt thời hạn lưu (RECRUITMENT_RETENTION_DAYS).
 */

function envFlag(name: string): boolean {
  const v = String(process.env[name] || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT_EXTS = [".pdf", ".doc", ".docx"] as const;

export function recruitmentNoticeVersion(): string {
  return String(process.env.RECRUITMENT_PRIVACY_VERSION || "2026-10-05").trim();
}

/** null = chưa chốt chính sách lưu → không nhận hồ sơ. */
export function recruitmentRetentionDays(): number | null {
  const n = Number(process.env.RECRUITMENT_RETENTION_DAYS);
  if (!Number.isInteger(n) || n < 1 || n > 3650) return null;
  return n;
}

export function recruitmentApplyEnabled(): boolean {
  return recruitmentRetentionDays() != null;
}

/** Chưa có hạ tầng quét file → mặc định tắt nhận CV, dùng mô tả kinh nghiệm nhập tay. */
export function recruitmentCvEnabled(): boolean {
  return envFlag("RECRUITMENT_CV_ENABLED");
}

export function recruitmentMailEnabled(): boolean {
  return (
    envFlag("SHOP_MAIL_ENABLED") &&
    String(process.env.SHOP_MAIL_PROVIDER || "resend").trim().toLowerCase() === "resend" &&
    Boolean(String(process.env.RESEND_API_KEY || "").trim())
  );
}

/** Thư mục CV riêng tư — không nằm dưới /uploads phục vụ công khai. */
export function recruitmentCvDir(): string {
  const configured = String(process.env.RECRUITMENT_CV_DIR || "").trim();
  const dir = configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "private", "recruitment-cv");
  const uploadsRoot = path.resolve(process.cwd(), "uploads") + path.sep;
  if ((dir + path.sep).startsWith(uploadsRoot)) {
    throw new Error("RECRUITMENT_CV_DIR không được nằm trong thư mục uploads công khai");
  }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function locationKey(city: string, address: string): string {
  return slugifyVi(`${city} ${address}`).slice(0, 60) || "noi-lam";
}

/** Nơi làm Aloha đã xác nhận — RECRUITMENT_LOCATIONS='[{"city":"TP.HCM","address":"..."}]'. */
export function recruitmentConfiguredLocations(): JobLocation[] {
  const raw = String(process.env.RECRUITMENT_LOCATIONS || "").trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: JobLocation[] = [];
    const seen = new Set<string>();
    for (const x of arr) {
      const city = String(x?.city || "").trim().slice(0, 80);
      const address = String(x?.address || "").trim().slice(0, 250);
      if (!city) continue;
      const key = String(x?.key || "").trim() || locationKey(city, address);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, city, address });
    }
    return out;
  } catch {
    console.warn("[recruitment] RECRUITMENT_LOCATIONS không phải JSON hợp lệ");
    return [];
  }
}
