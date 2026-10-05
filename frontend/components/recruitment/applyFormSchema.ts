import { z } from "zod";

export type ApplyFormValues = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  interestedPosition: string;
  experienceLevel: string;
  experienceSummary: string;
  consent: boolean;
};

const phoneOk = (v: string) => {
  let s = v.replace(/\D/g, "");
  if (s.startsWith("84") && s.length >= 11) s = `0${s.slice(2)}`;
  return /^0\d{9,10}$/.test(s);
};

export function buildApplySchema(opts: { general: boolean; summaryRequired: boolean }) {
  return z.object({
    fullName: z.string().trim().min(1, "Nhập họ và tên").max(150),
    email: z.string().trim().min(1, "Nhập email").max(254).pipe(z.email("Email không hợp lệ")),
    phone: z.string().trim().min(1, "Nhập số điện thoại").max(30).refine(phoneOk, "Số điện thoại không hợp lệ"),
    location: z.string().min(1, "Chọn nơi làm việc mong muốn"),
    interestedPosition: opts.general
      ? z.string().trim().min(1, "Nhập công việc/vị trí quan tâm").max(150)
      : z.string(),
    experienceLevel: z
      .string()
      .refine((v) => ["experienced", "new_graduate", "intern", "no_experience"].includes(v), "Chọn kinh nghiệm"),
    experienceSummary: opts.summaryRequired
      ? z.string().trim().min(1, "Vị trí này cần mô tả kinh nghiệm").max(5000)
      : z.string().trim().max(5000),
    consent: z.boolean().refine((v) => v === true, "Cần đồng ý thông báo xử lý dữ liệu"),
  });
}

/** Tên trường lỗi từ server → ô form. */
export function serverFieldToFormField(field: string): keyof ApplyFormValues | "cv" | null {
  const f = field.split(".")[0];
  const map: Record<string, keyof ApplyFormValues | "cv"> = {
    fullName: "fullName",
    email: "email",
    phone: "phone",
    locationPreference: "location",
    interestedPosition: "interestedPosition",
    experienceLevel: "experienceLevel",
    experienceSummary: "experienceSummary",
    consent: "consent",
    cv: "cv",
  };
  return map[f] || null;
}

/** Kiểm tra sơ bộ phía trình duyệt; server vẫn nhận diện theo nội dung file. */
export function cvFileError(file: File, opts: { cvAcceptExts: string[]; cvMaxBytes: number }): string | null {
  const ext = (file.name.match(/\.[A-Za-z0-9]+$/)?.[0] || "").toLowerCase();
  if (!opts.cvAcceptExts.includes(ext)) return "CV chỉ nhận file PDF, DOC hoặc DOCX";
  if (file.size > opts.cvMaxBytes) return `CV tối đa ${Math.round(opts.cvMaxBytes / 1048576)}MB`;
  if (!file.size) return "File CV rỗng";
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
}
