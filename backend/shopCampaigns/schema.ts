import { z } from "zod";
import { MAX_GIFTS_PER_PRODUCT, type CampaignContent, type FieldError } from "./types.js";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MA = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;

/** Chữ thường một dòng: bỏ ký tự điều khiển; hiển thị luôn escape nên không cần lọc HTML. */
const plainText = (max: number) =>
  z
    .string()
    .max(max, `Tối đa ${max} ký tự`)
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim());

/** Link nội bộ (/...) hoặc https; chặn javascript:, data:, //domain. */
export function isSafeHref(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!s) return true;
  if (s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\")) return true;
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

/** Ảnh raster từ upload nội bộ hoặc https; chặn svg / data:. */
export function isSafeImageUrl(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!s) return true;
  if (!isSafeHref(s)) return false;
  return !/\.svg(\?|#|$)/i.test(s);
}

const href = z.string().max(500).refine(isSafeHref, "Chỉ dùng link trong web (bắt đầu bằng /) hoặc https://");
const imageUrl = z.string().max(500).refine(isSafeImageUrl, "Ảnh phải là JPG/PNG/WebP tải lên hoặc link https");
const isoDate = z.string().refine((s) => Number.isFinite(Date.parse(s)), "Ngày giờ không hợp lệ");
const intMin = (min: number, msg: string) => z.number().int(msg).min(min, msg);

const link = z.object({ label: plainText(40), href });

const slotSchema = z
  .object({
    key: z.string().regex(/^[A-Z0-9_]{1,12}$/, "Mã khung chỉ gồm chữ in hoa, số, gạch dưới"),
    start: z.string().regex(HHMM, "Giờ dạng HH:MM"),
    end: z.string().regex(HHMM, "Giờ dạng HH:MM"),
    overnight: z.boolean().optional(),
    label: plainText(20).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.start === s.end) ctx.addIssue({ code: "custom", path: ["end"], message: "Giờ kết thúc phải khác giờ bắt đầu" });
    else if (s.end < s.start && !s.overnight) {
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "Giờ kết thúc phải sau giờ bắt đầu (bật \"Qua nửa đêm\" nếu khung kéo sang hôm sau)",
      });
    }
  });

const giftSchema = z.object({
  ma: z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().regex(MA, "Mã quà không hợp lệ")),
  qty: intMin(1, "Số lượng quà tối thiểu 1").max(10),
  quota: intMin(1, "Số suất quà tối thiểu 1"),
});

/** Bản nháp cũ lưu `gift` (1 quà) → chuyển thành `gifts`. */
function liftLegacyGift(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const { gift, ...rest } = raw as Record<string, unknown>;
  return gift && rest.gifts === undefined ? { ...rest, gifts: [gift] } : rest;
}

const productSchema = z.preprocess(
  liftLegacyGift,
  z.object({
    ma: z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().regex(MA, "Mã sản phẩm không hợp lệ")),
    salePrice: intMin(0, "Giá sale phải là số nguyên ≥ 0"),
    compareAtPrice: intMin(0, "Giá trước khuyến mãi phải là số nguyên ≥ 0")
      .optional()
      .transform((v) => (v ? v : undefined)),
    quota: intMin(0, "Số lượng bán giá sale phải là số nguyên ≥ 0"),
    perCustomerLimit: intMin(1, "Giới hạn mỗi khách tối thiểu 1").max(99, "Giới hạn mỗi khách tối đa 99"),
    slotKey: z.string().max(12).optional(),
    gifts: z
      .array(giftSchema)
      .max(MAX_GIFTS_PER_PRODUCT, `Tối đa ${MAX_GIFTS_PER_PRODUCT} quà mỗi sản phẩm`)
      .transform((g) => (g.length ? g : undefined))
      .optional(),
    dealHot: z.boolean().optional(),
    paused: z.boolean().optional(),
  })
);

const bannerSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["main", "side"]),
  imageUrl,
  mobileImageUrl: imageUrl.optional(),
  href,
  alt: plainText(120).optional(),
});

const displaySchema = z.object({
  colors: z.object({
    primary: z.string().regex(HEX, "Màu dạng #RRGGBB"),
    accent: z.string().regex(HEX, "Màu dạng #RRGGBB"),
    cream: z.string().regex(HEX, "Màu dạng #RRGGBB"),
  }),
  announcement: z.object({ text: plainText(140), href: href.optional() }),
  headerPill: z.object({ text: plainText(40), href: href.optional() }),
  banners: z.array(bannerSchema).max(12),
  hero: z.object({
    title: plainText(120),
    subtitle: plainText(240),
    benefits: z.array(plainText(60)).max(6),
    tags: z.array(plainText(40)).max(6),
    deadline: plainText(120).optional(),
    primaryCta: link.optional(),
    secondaryCta: link.optional(),
  }),
  tiles: z.array(z.object({ icon: z.string().max(40), label: plainText(24), href })).max(8),
  welcome: z.object({ enabled: z.boolean(), title: plainText(80), body: plainText(240) }),
  flashStage: z.object({ title: plainText(60), badge: plainText(24), subtitle: plainText(140) }).optional(),
});

export const campaignContentSchema = z
  .object({
    info: z.object({
      name: plainText(80).pipe(z.string().min(1, "Vui lòng nhập tên chiến dịch")),
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Đường dẫn chỉ gồm chữ thường, số, gạch ngang").max(60),
      startAt: isoDate,
      endAt: isoDate,
      teaserDays: intMin(0, "Số ngày xem trước từ 0 đến 14").max(14, "Số ngày xem trước từ 0 đến 14"),
      testOnly: z.boolean(),
    }),
    products: z.array(productSchema).max(300, "Tối đa 300 sản phẩm mỗi chiến dịch"),
    slots: z.array(slotSchema).max(8),
    voucherIds: z.array(z.string().min(1).max(80)).max(30),
    display: displaySchema,
  })
  .superRefine((c, ctx) => {
    if (Date.parse(c.info.endAt) <= Date.parse(c.info.startAt)) {
      ctx.addIssue({ code: "custom", path: ["info", "endAt"], message: "Ngày kết thúc phải sau ngày bắt đầu" });
    }
    checkSlotsAndProducts(c, ctx);
  });

function checkSlotsAndProducts(c: z.infer<typeof campaignContentSchema>, ctx: z.RefinementCtx) {
  const slotKeys = new Set<string>();
  c.slots.forEach((s, i) => {
    if (slotKeys.has(s.key)) ctx.addIssue({ code: "custom", path: ["slots", i, "key"], message: "Trùng mã khung giờ" });
    slotKeys.add(s.key);
  });
  const seen = new Set<string>();
  c.products.forEach((p, i) => {
    if (p.slotKey && !slotKeys.has(p.slotKey)) {
      ctx.addIssue({ code: "custom", path: ["products", i, "slotKey"], message: "Khung giờ không tồn tại" });
    }
    const key = `${p.ma}|${p.slotKey || ""}`;
    if (seen.has(key)) {
      ctx.addIssue({ code: "custom", path: ["products", i, "ma"], message: "Sản phẩm bị lặp trong cùng khung giờ" });
    }
    seen.add(key);
    if (p.salePrice > 0 && p.quota < 1) {
      ctx.addIssue({ code: "custom", path: ["products", i, "quota"], message: "Nhập số lượng bán giá sale" });
    }
    if (p.salePrice > 0 && p.compareAtPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["products", i, "compareAtPrice"],
        message: "Chỉ nhập giá sale hoặc giá trước khuyến mãi, không nhập cả hai",
      });
    }
    const giftMas = new Set<string>();
    (p.gifts || []).forEach((g, j) => {
      if (giftMas.has(g.ma)) {
        ctx.addIssue({ code: "custom", path: ["products", i, "gifts", j, "ma"], message: `Quà ${g.ma} bị chọn 2 lần` });
      }
      giftMas.add(g.ma);
    });
  });
}

export type CampaignValidation =
  | { ok: true; value: CampaignContent }
  | { ok: false; fields: FieldError[] };

export function isInvalidCampaign(v: CampaignValidation): v is { ok: false; fields: FieldError[] } {
  return v.ok === false;
}

export function validateCampaignContent(input: unknown): CampaignValidation {
  const r = campaignContentSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data as CampaignContent };
  return {
    ok: false,
    fields: r.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
  };
}
