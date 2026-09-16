import { z } from "zod";

export const seoHomeSchema = z.object({
  title: z.string().trim().min(1, "Nhập tiêu đề").max(100, "Tối đa 100 ký tự"),
  description: z
    .string()
    .trim()
    .min(1, "Nhập mô tả")
    .max(200, "Tối đa 200 ký tự"),
  ogImageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  googleSiteVerification: z.string().trim().max(120).optional().or(z.literal("")),
  enableProductJsonLd: z.boolean(),
  enableOrgJsonLd: z.boolean(),
});

export type SeoHomeInput = z.infer<typeof seoHomeSchema>;

export const seoProductTplSchema = z.object({
  productTitleTemplate: z
    .string()
    .trim()
    .min(1, "Nhập template tiêu đề")
    .max(120),
  productDescriptionTemplate: z
    .string()
    .trim()
    .min(1, "Nhập template mô tả")
    .max(320),
});

export type SeoProductTplInput = z.infer<typeof seoProductTplSchema>;

export const seoCategoryTplSchema = z.object({
  categoryTitleTemplate: z
    .string()
    .trim()
    .min(1, "Nhập template tiêu đề")
    .max(120),
  categoryDescriptionTemplate: z
    .string()
    .trim()
    .min(1, "Nhập template mô tả")
    .max(320),
});

export type SeoCategoryTplInput = z.infer<typeof seoCategoryTplSchema>;

export const seoRedirectSchema = z.object({
  fromPath: z.string().trim().min(1, "Nhập đường dẫn cũ"),
  toPath: z.string().trim().min(1, "Nhập đường dẫn mới"),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export type SeoRedirectInput = z.infer<typeof seoRedirectSchema>;

export const productSeoOverrideSchema = z.object({
  seoTitle: z.string().trim().max(120).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(320).optional().or(z.literal("")),
});

export type ProductSeoOverrideInput = z.infer<typeof productSeoOverrideSchema>;
