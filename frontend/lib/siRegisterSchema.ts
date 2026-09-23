import { z } from "zod";
export const siRegisterSchema = z.object({
  phone: z.string().trim().regex(/^(0[35789]\d{8}|\+?84[35789]\d{8})$/, "Nhập SĐT Việt Nam hợp lệ"),
  province: z.string().trim().min(2, "Nhập tỉnh / thành phố").max(120),
  ward: z.string().trim().min(2, "Nhập phường / xã").max(120),
  detail: z.string().trim().min(3, "Nhập số nhà, tên đường").max(300),
  fullName: z.string().trim().min(2, "Nhập họ tên người liên hệ").max(120),
  shopName: z.string().max(160), businessType: z.string().max(80), taxCode: z.string().max(30),
  note: z.string().max(1000), email: z.string(), password: z.string(),
  acceptedTerms: z.boolean().refine(Boolean, "Vui lòng đồng ý điều khoản mua sỉ"),
});
export type SiRegisterInput = z.infer<typeof siRegisterSchema>;
