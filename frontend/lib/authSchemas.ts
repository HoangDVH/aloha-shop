import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Nhập họ tên"),
    email: z.string().trim().email("Email không hợp lệ"),
    phone: z.string().trim().optional(),
    password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
    asCustomer: z.boolean(),
    asCtv: z.boolean(),
    ctvCode: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.asCustomer && !v.asCtv) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chọn ít nhất Khách mua hoặc Cộng tác viên",
        path: ["asCustomer"],
      });
    }
    if (v.asCtv && v.ctvCode) {
      const code = v.ctvCode.toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mã CTV 3–20 ký tự (A-Z, 0-9, _, -)",
          path: ["ctvCode"],
        });
      }
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Nhập họ tên"),
  phone: z.string().trim().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const becomeCtvSchema = z.object({
  ctvCode: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[A-Z0-9_-]{3,20}$/i.test(v), {
      message: "Mã CTV 3–20 ký tự (A-Z, 0-9, _, -)",
    }),
});
export type BecomeCtvInput = z.infer<typeof becomeCtvSchema>;
