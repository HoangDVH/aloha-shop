import { z } from 'zod';

export const giftCollectionInputSchema = z.object({
  slug: z.string().trim().min(2, 'Slug tối thiểu 2 ký tự').regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch nối'),
  title: z.string().trim().min(2, 'Tiêu đề tối thiểu 2 ký tự').max(200, 'Tiêu đề tối đa 200 ký tự'),
  subtitle: z.string().trim().max(300).default(''),
  tag: z.string().trim().max(50).default('Gợi ý quà'),
  recipientType: z.string().trim().min(1, 'Vui lòng chọn nhóm đối tượng').default('nguoi-thuong'),
  image: z.string().trim().min(1, 'Vui lòng chọn hoặc tải ảnh lên').max(1000),
  quote: z.string().trim().max(500).default(''),
  includedItems: z.string().trim().max(300).default('Chậu gốm + Nơ ruy băng + Thiệp viết tay + Túi quai trong'),
  linkedProductCodes: z.array(z.string().trim().min(1).max(100)).max(100)
    .transform((codes) => [...new Set(codes)]).default([]),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// Updates must not apply create defaults to omitted fields (e.g. toggling visibility
// must never clear the curated products or reset the card's other settings).
export const giftCollectionUpdateSchema = z.object({
  ...giftCollectionInputSchema.shape,
  subtitle: giftCollectionInputSchema.shape.subtitle.removeDefault(),
  tag: giftCollectionInputSchema.shape.tag.removeDefault(),
  recipientType: giftCollectionInputSchema.shape.recipientType.removeDefault(),
  quote: giftCollectionInputSchema.shape.quote.removeDefault(),
  includedItems: giftCollectionInputSchema.shape.includedItems.removeDefault(),
  linkedProductCodes: giftCollectionInputSchema.shape.linkedProductCodes.removeDefault(),
  order: giftCollectionInputSchema.shape.order.removeDefault(),
  isActive: giftCollectionInputSchema.shape.isActive.removeDefault(),
}).partial();
