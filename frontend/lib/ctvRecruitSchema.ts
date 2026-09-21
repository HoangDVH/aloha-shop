import { z } from "zod";

const phoneVn = z
  .string()
  .trim()
  .min(1, "Nhập số điện thoại")
  .refine((v) => {
    let s = v.replace(/\D/g, "");
    if (s.startsWith("84") && s.length >= 11) s = `0${s.slice(2)}`;
    return /^0\d{9,10}$/.test(s);
  }, "Số điện thoại không hợp lệ");

const zaloField = z
  .string()
  .trim()
  .min(1, "Nhập Zalo")
  .refine((v) => {
    if (/^https?:\/\/(www\.)?zalo\.me\//i.test(v)) return true;
    let s = v.replace(/\D/g, "");
    if (s.startsWith("84") && s.length >= 11) s = `0${s.slice(2)}`;
    return /^0\d{9,10}$/.test(s);
  }, "Zalo không hợp lệ (SĐT hoặc link zalo.me)");

export const CTV_REFERRAL_CHANNELS = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "zalo", label: "Zalo" },
  { value: "website", label: "Website" },
  { value: "khac", label: "Khác" },
] as const;

export const CTV_REFERRAL_SOURCES = [
  "Facebook / Instagram",
  "Zalo / bạn bè giới thiệu",
  "TikTok / YouTube",
  "Google tìm kiếm",
  "Đã mua hàng tại Aloha",
  "Khác",
] as const;

/** Hồ sơ CTV P0 — dùng chung guest register + PATCH becomeCtv. */
export const ctvApplicationFieldsSchema = z
  .object({
    fullName: z.string().trim().min(1, "Nhập họ và tên"),
    phone: phoneVn,
    zalo: zaloField,
    addressText: z.string().trim().min(1, "Nhập địa chỉ"),
    referralChannel: z.enum(["facebook", "tiktok", "youtube", "zalo", "website", "khac"], {
      error: "Chọn kênh bán",
    }),
    channelUrl: z
      .string()
      .trim()
      .url("Link kênh phải bắt đầu bằng http:// hoặc https://")
      .refine((u) => /^https?:\/\//i.test(u), "Link kênh phải bắt đầu bằng http:// hoặc https://"),
    referralSource: z.string().trim().optional(),
    hasBusinessExp: z.enum(["co_roi", "chua_co"], {
      error: "Chọn đã có / chưa có kinh nghiệm",
    }),
    businessExpNote: z.string().trim().optional(),
    businessExpYears: z.union([z.string(), z.number()]).optional(),
    agreeTerms: z.boolean().refine((v) => v === true, {
      message: "Đọc hết điều khoản và bấm «Tôi đã hiểu» để tiếp tục",
    }),
  })
  .superRefine((v, ctx) => {
    if (v.hasBusinessExp === "co_roi") {
      if (!String(v.businessExpNote || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nhập bạn đang / đã kinh doanh gì",
          path: ["businessExpNote"],
        });
      }
      const y = Number(v.businessExpYears);
      if (!Number.isInteger(y) || y < 1 || y > 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Số năm kinh nghiệm từ 1 đến 50",
          path: ["businessExpYears"],
        });
      }
    }
  });

export type CtvApplicationFieldsInput = z.infer<typeof ctvApplicationFieldsSchema>;

export const ctvRecruitGuestSchema = ctvApplicationFieldsSchema
  .and(
    z.object({
      email: z.string().trim().email("Email không hợp lệ"),
      password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
      passwordConfirm: z.string().min(1, "Xác nhận mật khẩu"),
    })
  )
  .superRefine((v, ctx) => {
    if (v.password !== v.passwordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mật khẩu xác nhận không khớp",
        path: ["passwordConfirm"],
      });
    }
  });

export type CtvRecruitGuestInput = z.infer<typeof ctvRecruitGuestSchema>;

/** Khách đã login — không cần email/MK. */
export const ctvRecruitLoggedInSchema = ctvApplicationFieldsSchema;
export type CtvRecruitLoggedInInput = z.infer<typeof ctvRecruitLoggedInSchema>;

export function toCtvApplicationPayload(v: CtvApplicationFieldsInput) {
  const has = v.hasBusinessExp === "co_roi";
  return {
    fullName: v.fullName.trim(),
    phone: v.phone.trim(),
    zalo: v.zalo.trim(),
    addressText: v.addressText.trim(),
    referralChannel: v.referralChannel,
    channelUrl: v.channelUrl.trim(),
    referralSource: String(v.referralSource || "").trim() || undefined,
    hasBusinessExp: has,
    businessExpNote: has ? String(v.businessExpNote || "").trim() : undefined,
    businessExpYears: has ? Number(v.businessExpYears) : undefined,
  };
}
