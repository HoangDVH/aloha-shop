import { z } from "zod";

export const ctvStatusSchema = z.enum(["cho_duyet", "active", "khoa"]);

export const commissionStatusSchema = z.enum([
  "held",
  "eligible",
  "billed",
  "paid_out",
  "cancelled",
  "flagged",
]);

export const ctvListFilterSchema = z.object({
  q: z.string().optional(),
  ctvStatus: ctvStatusSchema.optional(),
});

export type CtvListFilter = z.infer<typeof ctvListFilterSchema>;

export const commissionFilterSchema = z.object({
  status: commissionStatusSchema.optional(),
  ctvCode: z.string().optional(),
  period: z.string().regex(/^\d{4}-\d{2}(-K[12])?$/).optional(),
});

export type CommissionFilter = z.infer<typeof commissionFilterSchema>;

export const payoutBankSchema = z.object({
  bankBin: z.string().trim().min(1, "Chọn ngân hàng").max(20),
  bankName: z.string().trim().min(1, "Thiếu tên ngân hàng").max(120),
  accountNumber: z
    .string()
    .trim()
    .min(5, "Số TK quá ngắn")
    .max(30)
    .regex(/^[0-9]+$/, "Số TK chỉ gồm chữ số"),
  accountName: z.string().trim().min(2, "Thiếu tên chủ TK").max(120),
});

export type PayoutBankInput = z.infer<typeof payoutBankSchema>;

export const periodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}(-K[12])?$/, "Kỳ dạng YYYY-MM hoặc YYYY-MM-K1/K2"),
});
