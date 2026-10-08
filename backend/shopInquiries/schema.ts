import { z } from 'zod';

export const inquiryStatusSchema = z.enum(['new', 'contacted', 'quoted', 'won', 'closed']);
export const inquirySourceSchema = z.enum(['b2b', 'gift_consultation']);
export const inquiryInputSchema = z.object({
  requestId: z.uuid(),
  source: inquirySourceSchema,
  companyName: z.string().trim().max(200).default(''),
  contactName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(150),
  phone: z.string().trim().max(30).transform((s) => s.replace(/[\s().-]/g, ''))
    .pipe(z.string().regex(/^(?:0\d{9}|\+84\d{9}|84\d{9})$/, 'Vui lòng nhập số điện thoại Việt Nam hợp lệ')),
  email: z.union([z.email().max(254), z.literal('')]).default(''),
  quantity: z.string().trim().max(100).default(''),
  budgetPerSet: z.string().trim().max(100).default(''),
  eventDate: z.string().trim().max(150).default(''),
  occasion: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(3000).default(''),
}).refine((v) => v.source !== 'b2b' || v.companyName.length >= 2, {
  path: ['companyName'], message: 'Vui lòng nhập tên doanh nghiệp',
});

export const inquiryListSchema = z.object({
  q: z.string().trim().max(100).default(''),
  status: z.union([inquiryStatusSchema, z.literal('all')]).default('all'),
  source: z.union([inquirySourceSchema, z.literal('all')]).default('all'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const inquiryUpdateSchema = z.object({
  version: z.number().int().min(0),
  status: inquiryStatusSchema,
  adminNotes: z.string().trim().max(4000).default(''),
});
