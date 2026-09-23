import { z } from "zod";
import { normalizeWholesalePhone } from "./policy.js";

export const addressSchema = z.object({
  phone: z.string().transform(normalizeWholesalePhone).pipe(z.string().regex(/^0[35789]\d{8}$/, "Số điện thoại không hợp lệ")),
  province: z.string().trim().min(2).max(120),
  district: z.string().trim().max(120).optional().default(""),
  ward: z.string().trim().min(2).max(120),
  detail: z.string().trim().min(3).max(300),
});
export const applicationSchema = addressSchema.extend({
  lookupId: z.string().uuid(), fullName: z.string().trim().min(2).max(120),
  shopName: z.string().trim().max(160).default(""),
  businessType: z.string().trim().max(80).default(""),
  taxCode: z.string().trim().max(30).default(""),
  note: z.string().trim().max(1000).default(""),
  email: z.string().trim().email().transform(v => v.toLowerCase()).optional(),
  password: z.string().min(8).max(128).optional(),
  acceptedTerms: z.literal(true),
});

export function canonicalAddress(input: { province: string; ward: string; detail: string }) {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d").trim().replace(/\s+/g, " ");
  return [norm(input.province), norm(input.ward), norm(input.detail)].join("|");
}
