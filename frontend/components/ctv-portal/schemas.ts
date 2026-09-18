import { z } from "zod";

export {
  payoutBankSchema,
  type PayoutBankInput,
} from "@/components/admin/ctv/schemas";

export const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, "Nhập họ tên").max(120),
  phone: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || /^0\d{9,10}$/.test(v.replace(/\s/g, "")),
      "SĐT không hợp lệ"
    ),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

export const conversionFilterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderCode: z.string().optional(),
  orderStatus: z.string().default("all"),
  paymentStatus: z.string().default("all"),
});

export type ConversionFilterInput = z.infer<typeof conversionFilterSchema>;
